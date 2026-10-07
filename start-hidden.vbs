' Mister Hogs SmartPOS — silent startup launcher.
' Put a SHORTCUT to this file (not the file itself) in the Windows Startup
' folder so the server starts automatically, with no visible window, every
' time this computer signs in. See README.md for how to set that up.

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir

' 0 = run with no visible window. False = don't wait for it to finish
' (it's a server — it isn't supposed to finish).
shell.Run "cmd /c node server.js", 0, False
