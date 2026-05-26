Set fso = CreateObject("Scripting.FileSystemObject")
Set ws = CreateObject("WScript.Shell")

settingsPath = ws.ExpandEnvironmentStrings("%USERPROFILE%") & "\.nazavtra\settings.json"
port = 5174
If fso.FileExists(settingsPath) Then
  Set file = fso.OpenTextFile(settingsPath)
  json = file.ReadAll()
  file.Close
  Set re = New RegExp
  re.Pattern = """port""\s*:\s*(\d+)"
  Set matches = re.Execute(json)
  If matches.Count > 0 Then port = CInt(matches(0).SubMatches(0))
End If

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ws.CurrentDirectory = scriptDir
ws.Run "npm run dev -- --port " & port, 0, False
WScript.Sleep 2000
ws.Run "http://localhost:" & port & "/NaZavtra/", 1, False
