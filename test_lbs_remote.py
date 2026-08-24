import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('200.141.9.19', username='root', password='Meets@081105')

cmd = """docker exec school-backend node -e "
const { resolveCellLocation } = require('./services/lbs-service');
resolveCellLocation({ mcc: 404, mnc: 11, lac: 10365, cellId: 4452 }).then(r => console.log('RESOLVED LBS CELL:', r));
" """

stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:", stdout.read().decode('utf-8'))
print("STDERR:", stderr.read().decode('utf-8'))
ssh.close()
