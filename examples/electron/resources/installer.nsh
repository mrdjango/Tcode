!macro customInstall
  ; Keep shortcuts independent from the executable icon resource cached by Windows.
  Delete "$newDesktopLink"
  CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\tensorgrid-mark.ico" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"

  Delete "$newStartMenuLink"
  CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\tensorgrid-mark.ico" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
