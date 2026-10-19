import { execSync } from 'node:child_process'
import process from 'node:process'

if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM NotionFlow.exe /T', { stdio: 'ignore' })
    console.log('[kill-running] Terminated running NotionFlow processes.')
  } catch {
    // Process was not running
  }
  try {
    execSync('taskkill /F /IM Pagegrove.exe /T', { stdio: 'ignore' })
    console.log('[kill-running] Terminated running Pagegrove processes.')
  } catch {
    // Process was not running
  }
  try {
    // Brief sleep to allow Windows OS to fully release file locks on executables
    execSync('powershell -Command "Start-Sleep -Milliseconds 600"', { stdio: 'ignore' })
  } catch {
    // Ignore sleep error
  }
}
