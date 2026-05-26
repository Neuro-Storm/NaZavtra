Set ws = CreateObject("WScript.Shell")
ws.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
ws.Run "npm run dev", 0, False
WScript.Sleep 2000
ws.Run "http://localhost:5174/NaZavtra/", 1, False
