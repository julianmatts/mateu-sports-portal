; ============================================================
; PUENTE ESCANER - Mateu Sports (Buscador de Articulos)
; Version 2.1
; ------------------------------------------------------------
; Corre de fondo en la PC del salon. Cuando el vendedor escanea
; una etiqueta PARADO EN EL SISTEMA (o en cualquier ventana),
; detecta la rafaga de la lectora (tipeo velocisimo, imposible
; de hacer a mano) y publica el codigo en Firebase:
;    scanBridge/<sucursal>   de la base ubicaciones-mateu
; El Buscador de Articulos lo escucha en vivo y muestra el
; articulo con su ubicacion. Una pasada de lectora, dos pantallas.
;
; NO toca el sistema: las teclas siguen yendo a la ventana activa.
;
; QUE CAMBIO RESPECTO DE LA v1 (la que no publicaba nada)
;  1) El pedido a Firebase se hacia asincronico y el objeto se
;     liberaba al salir de la funcion: Windows cancelaba el envio
;     antes de mandarlo. Ahora es sincronico y se lee la respuesta.
;  2) Las teclas se juntan con InputHook (buffer continuo). La v1
;     reiniciaba la captura letra por letra y perdia caracteres de
;     las lectoras rapidas.
;  3) Se aceptan lectoras con Enter del pad numerico y lectoras
;     SIN tecla final (se publica sola a los 350 ms).
;  4) Menu en la bandeja: Probar el puente / Ver estado, para
;     saber en el momento si anda y por que no.
;
; Requiere AutoHotkey v1.1 (ideal 1.1.34 o mas nuevo).
; Ver LEEME.txt para la instalacion.
; ============================================================
#Persistent
#SingleInstance Force
#NoEnv
SetBatchLines, -1
SetWorkingDir, %A_ScriptDir%

global VERSION, FB_BASE, PORTAL, SLUGS, CFG, SLUG, URL, MODO
global BUF, T0, TULT, ULT_COD, ULT_TICK
global EST_HORA, EST_COD, EST_TXT, N_OK, N_ERR, IH

VERSION := "2.1"
FB_BASE := "https://ubicaciones-mateu-default-rtdb.firebaseio.com/scanBridge/"
PORTAL  := "https://mateu-sports-portal.pages.dev/ubicaciones/"
; mismas sucursales que el Portal (SUCURSALES de ubicaciones/index.html)
SLUGS   := "calle-12,city-bell,diagonal,calle-47,calle-49,los-hornos,plaza,berisso,ensenada,kids,aurelius-12,aurelius-5,aurelius-cb,adidas-12,adidas,originals,ecommerce,deposito"
CFG     := A_ScriptDir . "\config.ini"
BUF := "", T0 := 0, TULT := 0, ULT_COD := "", ULT_TICK := 0
N_OK := 0, N_ERR := 0
EST_HORA := "", EST_COD := "", EST_TXT := "todavia no llego ningun escaneo"

; --- sucursal: se lee de config.ini; la primera vez se pregunta y se guarda ---
IniRead, SLUG, %CFG%, puente, sucursal, __nada__
if (SLUG = "__nada__" or SLUG = "")
{
    SLUG := ""
    if (!PedirSucursal())
        ExitApp
}
SLUG := Normalizar(SLUG)
URL := FB_BASE . SLUG . ".json"

; --- menu de la bandeja (al lado del reloj) ---
Menu, Tray, NoStandard
Menu, Tray, Add, Probar el puente, MenuProbar
Menu, Tray, Add, Vincular la pantalla de esta PC, MenuVincular
Menu, Tray, Add, Ver estado, MenuEstado
Menu, Tray, Add
Menu, Tray, Add, Cambiar sucursal, MenuSucursal
Menu, Tray, Add, Salir, MenuSalir
Menu, Tray, Default, Ver estado
Tip()

; --- captura de teclas ---
; InputHook (AutoHotkey 1.1.34+) junta las teclas de fondo, sin
; perder ninguna aunque el script este ocupado publicando.
IH := ""
try
{
    fn := Func("InputHook")
    if (fn and A_AhkVersion >= "1.1.34")
        IH := fn.Call("V I", "{Enter}{Tab}{NumpadEnter}")
}
catch e
{
    IH := ""
}
if (IH)
{
    MODO := "InputHook"
    IH.VisibleText := true       ; las teclas siguen yendo al sistema
    IH.VisibleNonText := true
    IH.OnChar := Func("EnChar")
    IH.OnEnd := Func("EnFin")
    IH.Start()
    return                        ; queda escuchando (#Persistent lo mantiene vivo)
}

; --- modo compatible: AutoHotkey viejo, sin InputHook ---
MODO := "Input (AutoHotkey viejo)"
Loop
{
    Input, ch, L1 V I, {Enter}{Tab}{NumpadEnter}
    fin := ErrorLevel
    ahora := A_TickCount
    if (BUF != "" and ahora - TULT > 200)
        BUF := ""
    if (InStr(fin, "EndKey:"))
    {
        codigo := BUF
        BUF := ""
        Evaluar(codigo, ahora)
    }
    else if (ch != "")
    {
        if (BUF = "")
            T0 := ahora
        BUF .= ch
        TULT := ahora
    }
}

; ============================================================
;  JUNTAR LA RAFAGA
; ============================================================
EnChar(ih, char)
{
    ahora := A_TickCount
    if (BUF != "" and ahora - TULT > 200)   ; pausa larga: arranca de nuevo
        BUF := ""
    if (BUF = "")
        T0 := ahora
    BUF .= char
    TULT := ahora
    SetTimer, Vaciar, -350                  ; por si la lectora no manda Enter
}

EnFin(ih)
{
    codigo := BUF
    BUF := ""
    SetTimer, Vaciar, Off
    ih.Start()                              ; volver a escuchar YA
    Evaluar(codigo, A_TickCount)
}

; lectora sin tecla final: se publica cuando para de tipear
Vaciar:
    if (BUF != "")
    {
        cod := BUF
        BUF := ""
        Evaluar(cod, A_TickCount)
    }
return

; ============================================================
;  DECIDIR SI ES LA LECTORA Y PUBLICAR
; ============================================================
Evaluar(codigo, ahora)
{
    codigo := Limpiar(codigo)
    len := StrLen(codigo)
    if (len < 5)
        return
    dur := ahora - T0
    if (dur > len * 45)                     ; muy lento: lo tipeo una persona
        return
    if (codigo = ULT_COD and ahora - ULT_TICK < 1200)   ; misma pasada repetida
        return
    ULT_COD := codigo
    ULT_TICK := ahora
    Publicar(codigo, false)
}

; devuelve "" si salio bien, o el motivo del error
Publicar(codigo, esPrueba)
{
    extra := esPrueba ? ",""test"":true" : ""
    body := "{""codigo"":""" . codigo . """,""ts"":{"".sv"":""timestamp""},""pc"":""" . Limpiar(A_ComputerName) . """" . extra . "}"
    err := ""
    try
    {
        whr := ComObjCreate("WinHttp.WinHttpRequest.5.1")
        whr.Open("PUT", URL, false)          ; sincronico: el asincronico se cancelaba solo
        whr.SetTimeouts(2000, 3000, 3000, 4000)
        whr.SetRequestHeader("Content-Type", "application/json")
        whr.Send(body)
        st := whr.Status
        if (st >= 200 and st < 300)
            N_OK += 1
        else
        {
            err := "Firebase respondio " . st
            N_ERR += 1
        }
    }
    catch e
    {
        err := "sin conexion (" . e.message . ")"
        N_ERR += 1
    }
    Estado(codigo, err = "" ? "enviado OK" : err)
    return err
}

; ============================================================
;  ESTADO / MENU
; ============================================================
Estado(codigo, txt)
{
    FormatTime, hh, , HH:mm:ss
    EST_HORA := hh
    EST_COD := codigo
    EST_TXT := txt
    Tip()
}

Tip()
{
    t := "Puente escaner Mateu - " . SLUG
    if (EST_HORA != "")
        t .= "`n" . EST_HORA . " " . EST_COD . ": " . EST_TXT
    Menu, Tray, Tip, %t%
}

MenuProbar:
    err := Publicar("PUENTE-TEST", true)
    if (err = "")
        MsgBox, 64, Puente escaner Mateu, % "El puente funciona.`n`nSucursal: " . SLUG . "`n`nMira la pantalla del Buscador: tiene que decir ""Puente conectado"".`nSi el Buscador no dice nada, revisa que esa pantalla este abierta en el Buscador de Articulos de la MISMA sucursal (" . SLUG . ")."
    else if (InStr(err, "sin conexion"))
        MsgBox, 48, Puente escaner Mateu, % "No se pudo publicar: " . err . "`n`nQue mirar:`n1) Que la PC tenga internet (abri el Portal en el navegador).`n2) En Windows 7: falta TLS 1.2. Instalar la actualizacion KB3140245 de Microsoft y su ""Easy Fix"", y reiniciar.`n3) Si hay proxy o firewall, habilitar ubicaciones-mateu-default-rtdb.firebaseio.com"
    else
        MsgBox, 48, Puente escaner Mateu, % "No se pudo publicar: " . err . "`n`nAvisale a Juli con esta pantalla."
return

; Si el salon tiene varias PC con puente, cada pantalla del Buscador sigue a
; UNA. Normalmente se vincula sola (la primera etiqueta que se escanea con esa
; pantalla abierta la deja emparejada con la lectora de esa PC). Esto es el
; atajo para hacerlo sin escanear: abre el Buscador con el nombre de esta PC.
MenuVincular:
    pc := Limpiar(A_ComputerName)
    Run, % PORTAL . "?pc=" . pc, , UseErrorLevel
    if (ErrorLevel)
        MsgBox, 48, Puente escaner Mateu, % "No se pudo abrir el navegador.`n`nAbri a mano esta direccion en la PC:`n`n" . PORTAL . "?pc=" . pc
    else
        MsgBox, 64, Puente escaner Mateu, % "Se abrio el Buscador con el nombre de esta PC (" . pc . ").`n`nEsa pantalla ya quedo vinculada al escaner de esta PC: los escaneos de las otras PC del salon no le van a cambiar la busqueda.`n`nPodes cerrar la pestana que se abrio; si el Buscador ya estaba abierto en otra ventana del MISMO navegador, tambien toma el cambio."
return

MenuEstado:
    m := "PUENTE ESCANER - Mateu Sports  v" . VERSION
    m .= "`n`nSucursal: " . SLUG
    m .= "`nCaptura: " . MODO
    m .= "`nAutoHotkey: " . A_AhkVersion . (A_IsAdmin ? " (como administrador)" : "")
    m .= "`n`nEscaneos enviados: " . N_OK . "   con error: " . N_ERR
    m .= "`nUltimo: " . (EST_HORA = "" ? EST_TXT : EST_HORA . "  " . EST_COD . "  -> " . EST_TXT)
    m .= "`n`nSi escaneas y aca no se mueve nada, la lectora no le esta"
    m .= "`nllegando al puente: pasa cuando el sistema corre COMO"
    m .= "`nADMINISTRADOR. Solucion: clic derecho en puente-escaner.ahk"
    m .= "`n-> Ejecutar como administrador (o tildarlo en Propiedades"
    m .= "`n-> Compatibilidad del acceso directo)."
    MsgBox, 64, Puente escaner Mateu, %m%
return

MenuSucursal:
    if (PedirSucursal())
    {
        SLUG := Normalizar(SLUG)
        URL := FB_BASE . SLUG . ".json"
        Tip()
    }
return

MenuSalir:
    ExitApp
return

; ============================================================
;  AYUDANTES
; ============================================================
PedirSucursal()
{
    lista := RegExReplace(SLUGS, ",", "   ")
    Loop
    {
        InputBox, s, Puente escaner Mateu, % "Escribi el slug de la sucursal de esta PC, tal cual esta en el Portal:`n`n" . lista, , 520, 220, , , , , %SLUG%
        if (ErrorLevel)
            return false
        s := Normalizar(s)
        if (s = "")
            continue
        if (!InStr("," . SLUGS . ",", "," . s . ","))
        {
            MsgBox, 48, Puente escaner Mateu, % "La sucursal """ . s . """ no existe.`nTiene que ser una de estas, tal cual:`n`n" . lista
            continue
        }
        SLUG := s
        IniWrite, %SLUG%, %CFG%, puente, sucursal
        if (ErrorLevel)
            MsgBox, 48, Puente escaner Mateu, % "Ojo: no se pudo guardar config.ini en " . A_ScriptDir . ".`nVa a preguntar la sucursal cada vez que arranque.`nMove la carpeta a Documentos y volve a abrirlo."
        return true
    }
}

Normalizar(s)
{
    s := Trim(s)
    StringLower, s, s
    s := RegExReplace(s, "[^a-z0-9\-]", "")
    return s
}

; los codigos son alfanumericos: se saca todo lo que pueda romper el JSON
Limpiar(s)
{
    return RegExReplace(s, "[^A-Za-z0-9\-_\.\$\/#\+ ]", "")
}
