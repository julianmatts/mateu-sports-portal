; ============================================================
; PUENTE ESCÁNER — Mateu Sports (Buscador de Artículos)
; ------------------------------------------------------------
; Corre de fondo en la PC del puesto de consulta. Cuando el
; vendedor escanea una etiqueta PARADO EN EL SISTEMA (o en
; cualquier ventana), este script detecta la ráfaga de la
; lectora (tipeo velocísimo terminado en Enter/Tab, imposible
; de reproducir a mano) y publica el código en Firebase:
;   scanBridge/<sucursal>  de la base ubicaciones-mateu
; El Buscador de Artículos en modo puesto lo escucha en vivo
; y muestra solo el artículo con su ubicación.
;
; NO interfiere con el sistema: las teclas pasan igual a la
; ventana activa (modo "visible"). El tipeo humano se descarta
; por velocidad. Requiere AutoHotkey v1.1 (funciona en Win 7+).
; Ver LEEME.txt para la instalación.
; ============================================================
#Persistent
#SingleInstance Force
#NoEnv
SetBatchLines -1

; --- sucursal: se lee de config.ini; la primera vez se pregunta y se guarda ---
IniRead, slug, %A_ScriptDir%\config.ini, puente, sucursal, __nada__
if (slug = "__nada__" or slug = "")
{
    InputBox, slug, Puente escaner Mateu, Escribi el slug de la sucursal tal como esta en el Portal`n(ej: diagonal  calle-49  plaza  aurelius-cb):, , 420, 170
    if (ErrorLevel or slug = "")
        ExitApp
    slug := Trim(slug)
    IniWrite, %slug%, %A_ScriptDir%\config.ini, puente, sucursal
}
URL := "https://ubicaciones-mateu-default-rtdb.firebaseio.com/scanBridge/" . slug . ".json"
Menu, Tray, Tip, Puente escaner Mateu - %slug%

; --- deteccion de rafaga de lectora ---
; buf acumula caracteres; una pausa >150 ms = tipeo humano, se descarta.
; Enter/Tab cierra: si hay >=5 caracteres y la rafaga duro menos de
; 45 ms por caracter, es la lectora -> se publica.
buf := ""
t0 := 0
tUlt := 0
Loop
{
    Input, ch, L1 V I, {Enter}{Tab}
    fin := ErrorLevel
    ahora := A_TickCount
    if (buf != "" and ahora - tUlt > 150)
        buf := ""
    if (fin = "EndKey:Enter" or fin = "EndKey:Tab")
    {
        dur := ahora - t0
        len := StrLen(buf)
        if (len >= 5 and dur < len * 45)
            Publicar(buf)
        buf := ""
    }
    else if (ch != "")
    {
        if (buf = "")
            t0 := ahora
        buf .= ch
        tUlt := ahora
    }
}

Publicar(codigo)
{
    global URL
    ; sanitizar por las dudas (los codigos son alfanumericos)
    StringReplace, codigo, codigo, ", , All
    StringReplace, codigo, codigo, \, , All
    ; epoch en milisegundos (para que el Buscador distinga escaneos nuevos)
    ts := A_NowUTC
    EnvSub, ts, 19700101000000, Seconds
    body := "{""codigo"":""" . codigo . """,""ts"":" . ts . "000}"
    try
    {
        whr := ComObjCreate("WinHttp.WinHttpRequest.5.1")
        whr.Open("PUT", URL, true)   ; asincronico: no frena nada si no hay internet
        whr.SetRequestHeader("Content-Type", "application/json")
        whr.Send(body)
    }
    catch e
    {
        ; sin conexion: se pierde ese escaneo, no molesta al vendedor
    }
}
