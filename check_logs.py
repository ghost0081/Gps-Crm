import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('200.141.9.19', username='root', password='Meets@081105')
stdin, stdout, stderr = ssh.exec_command('docker logs face-recognition-api')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()
