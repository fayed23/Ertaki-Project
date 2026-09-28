@echo off
REM Run as Administrator on the PC that hosts Docker.
REM Opens inbound TCP 80 and 8080 so phone / other PCs on the same LAN can reach Ertaki.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Right-click this file -^> Run as administrator
  pause
  exit /b 1
)

netsh advfirewall firewall delete rule name="Ertaki LAN 80" >nul 2>&1
netsh advfirewall firewall delete rule name="Ertaki LAN 8080" >nul 2>&1
netsh advfirewall firewall add rule name="Ertaki LAN 80" dir=in action=allow protocol=TCP localport=80 profile=private,domain
netsh advfirewall firewall add rule name="Ertaki LAN 8080" dir=in action=allow protocol=TCP localport=8080 profile=private,domain

echo.
echo Firewall rules added for TCP 80 and 8080 (Private/Domain profiles).
echo On the phone or other PC browser open:
echo   http://YOUR-PC-LAN-IP/api/health
echo   http://YOUR-PC-LAN-IP:8080/api/health
echo.
echo Make Wi-Fi "Private", turn off VPN, avoid Guest Wi-Fi.
pause
