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

  ; Register the installed Tcode executable as the handler for TensorGrid callbacks.
  WriteRegStr HKCU "Software\Classes\tcode" "" "URL:Tcode Protocol"
  WriteRegStr HKCU "Software\Classes\tcode" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\tcode\DefaultIcon" "" "$INSTDIR\resources\tensorgrid-mark.ico"
  WriteRegStr HKCU "Software\Classes\tcode\shell\open\command" "" "$\"$appExe$\" $\"%1$\""

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  ; Do not remove another application's handler if the association changed after installation.
  ReadRegStr $0 HKCU "Software\Classes\tcode\shell\open\command" ""
  StrCmp $0 "$\"$INSTDIR\Tcode.exe$\" $\"%1$\"" 0 done
  DeleteRegKey HKCU "Software\Classes\tcode"
done:
!macroend
