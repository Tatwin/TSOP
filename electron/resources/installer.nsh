; TASMAC POS Custom NSIS Installer Script
; This file is included in the NSIS installer build

!macro customHeader
  !system "echo 'TASMAC POS 1745 Installer'"
!macroend

!macro preInit
  ; Check for running instance before install
  SetShellVarContext current
!macroend

!macro customInit
  ; Custom initialization
!macroend

!macro customInstall
  ; Create Documents/TSOP_Backups folder for the user
  CreateDirectory "$DOCUMENTS\TSOP_Backups"
  
  ; Create a shortcut in startup folder (optional - commented out)
  ; CreateShortCut "$SMSTARTUP\TASMAC POS 1745.lnk" "$INSTDIR\TASMAC POS 1745.exe"
!macroend

!macro customUnInstall
  ; Clean up on uninstall (but keep user data!)
  ; IMPORTANT: Do NOT delete $APPDATA\tasmac-pos-desktop (user's database)
  ; Do NOT delete $DOCUMENTS\TSOP_Backups (user's backups)
  
  ; Only remove start menu and desktop shortcuts
  Delete "$DESKTOP\TASMAC POS 1745.lnk"
  RMDir /r "$SMPROGRAMS\TASMAC POS 1745"
!macroend
