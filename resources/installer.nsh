!include "FileFunc.nsh"
!include "LogicLib.nsh"

; Keep the directory page available, but treat its selected path as the parent
; directory so every custom installation is placed in a Jianlu subdirectory.
Function .onVerifyInstDir
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 != "Jianlu"
    StrCpy $INSTDIR "$INSTDIR\Jianlu"
  ${EndIf}
FunctionEnd
