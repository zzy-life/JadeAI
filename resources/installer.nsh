!include "FileFunc.nsh"
!include "LogicLib.nsh"

; electron-builder defaults APP_FILENAME to package.json's "jadeai" because the
; Chinese productName cannot be used as its Windows installation directory name.
; Keep its final directory check aligned with the directory appended below.
!undef APP_FILENAME
!define APP_FILENAME "Jianlu"

; A drive root such as D:\ is rejected by the directory page before
; electron-builder's later instFilesPre callback runs. Append Jianlu during
; directory validation so the displayed path is valid and Install stays enabled.
Function .onVerifyInstDir
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 != "Jianlu"
    StrCpy $INSTDIR "$INSTDIR\Jianlu"
  ${EndIf}
FunctionEnd
