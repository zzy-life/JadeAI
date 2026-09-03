; electron-builder defaults APP_FILENAME to package.json's "jadeai" because the
; Chinese productName cannot be used as its Windows installation directory name.
; Its assisted installer appends APP_FILENAME only when the selected path does
; not already contain it, so use the desired ASCII directory name here.
!undef APP_FILENAME
!define APP_FILENAME "Jianlu"
