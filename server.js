const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');

let db = loadDatabase();

function loadDatabase() {
  if (fs.existsSync(DB_PATH)) {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }
  return {
    users: { root: "toor", student: "student123", admin: "admin2026" },
    logs: [],
    sshd_config: {
      Port: 22,
      PermitRootLogin: "yes",
      PasswordAuthentication: "yes",
      MaxAuthTries: 6,
      PubkeyAuthentication: "yes"
    },
    blocked_ips: []
  };
}

function saveDatabase() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function logEvent(type, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${type}] ${message}`;
  db.logs.push(entry);
  if (db.logs.length > 500) db.logs.shift();
  saveDatabase();
  return entry;
}

// Симуляция фоновых Brute-Force атак
const botUsernames = ['root', 'admin', 'user', 'test', 'postgres', 'deploy'];
const botIps = ['192.168.1.105', '10.0.8.44', '172.16.0.99', '185.220.101.5', '45.33.32.156'];

setInterval(() => {
  const ip = botIps[Math.floor(Math.random() * botIps.length)];
  const user = botUsernames[Math.floor(Math.random() * botUsernames.length)];
  const port = Math.floor(Math.random() * 40000) + 10000;

  if (db.blocked_ips.includes(ip)) {
    logEvent('FIREWALL_DROP', `Blocked connection attempt from ${ip}:${port}`);
    return;
  }

  logEvent('AUTH_FAIL', `Failed password for ${user} from ${ip} port ${port} ssh2`);
}, 10000);

// Статика и Маршруты (Routes)
app.use(express.static(path.join(__dirname, 'public')));

app.get(['/edu', '/educational'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edu.html'));
});

app.get('/git', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'git.html'));
});

app.get('/github', (req, res) => {
  res.redirect('https://github.com/JunDevX/UseSimulateSSH');
});

// Таблица цветов для команды `color`
const colorMap = {
  '0': '#000000', '1': '#0000aa', '2': '#00aa00', '3': '#00aaaa',
  '4': '#aa0000', '5': '#aa00aa', '6': '#aa5500', '7': '#aaaaaa',
  '8': '#555555', '9': '#5555ff', 'a': '#55ff55', 'b': '#55ffff',
  'c': '#ff5555', 'd': '#ff55ff', 'e': '#ffff55', 'f': '#ffffff'
};

const themeMap = {
  'matrix': '#00ff66',
  'classic': '#cccccc',
  'cyber': '#00ffff',
  'ubuntu': '#ffffff'
};

io.on('connection', (socket) => {
  let state = 'AUTH_USER';
  let currentUser = '';
  let currentDir = '/home/student';

  socket.emit('output', 'OpenSSH_9.6p1 Ubuntu-3ubuntu13, OpenSSL 3.0.13\r\nlogin as: ');

  socket.on('input', (data) => {
    const input = data.trim();

    if (state === 'AUTH_USER') {
      if (!input) {
        socket.emit('output', 'login as: ');
        return;
      }
      currentUser = input;
      state = 'AUTH_PASS';
      socket.emit('output', `${currentUser}@localhost's password: `);
      return;
    }

    if (state === 'AUTH_PASS') {
      if (currentUser === 'root' && db.sshd_config.PermitRootLogin === 'no') {
        logEvent('AUTH_REJECTED', `Root login denied by sshd_config policy`);
        socket.emit('output', `\r\nAccess denied (root login disabled)\r\nlogin as: `);
        state = 'AUTH_USER';
        return;
      }

      if (db.users[currentUser] && db.users[currentUser] === input) {
        state = 'SHELL';
        if (currentUser === 'root') currentDir = '/root';
        logEvent('AUTH_SUCCESS', `User '${currentUser}' logged in from 127.0.0.1`);
        socket.emit('output', `\r\nWelcome to Ubuntu 24.04 LTS (GNU/Linux 6.8.0-31-generic x86_64)\r\n\r\nType 'help' for SSH commands or visit /edu for Docs.\r\nType 'git' or visit /git for Git over SSH manual.\r\n\r\n${currentUser}@sim-server:${currentDir}$ `);
      } else {
        logEvent('AUTH_FAIL', `Failed password for ${currentUser} from 127.0.0.1 port 52140 ssh2`);
        socket.emit('output', `\r\nAccess denied\r\nlogin as: `);
        state = 'AUTH_USER';
      }
      return;
    }

    if (state === 'SHELL') {
      if (input === 'clear') {
        socket.emit('clear');
        socket.emit('output', `${currentUser}@sim-server:${currentDir}$ `);
        return;
      }

      executeCommand(socket, currentUser, currentDir, input, (newDir) => {
        if (newDir) currentDir = newDir;
        socket.emit('output', `${currentUser}@sim-server:${currentDir}$ `);
      });
    }
  });
});

function executeCommand(socket, user, currentDir, commandStr, callback) {
  if (!commandStr) {
    socket.emit('output', '\r\n');
    callback(currentDir);
    return;
  }

  const parts = commandStr.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  logEvent('EXEC', `User '${user}' executed: ${commandStr}`);
  let updatedDir = currentDir;

  switch (cmd) {
    case 'color':
      if (args[0] && colorMap[args[0].toLowerCase()]) {
        const hex = colorMap[args[0].toLowerCase()];
        socket.emit('change_color', hex);
        socket.emit('output', `\r\n[OK] Terminal color updated to code '${args[0]}'\r\n\r\n`);
      } else {
        socket.emit('output', `\r\nUsage: color <0-9|a-f>\r\nExamples: color 2 (Green), color 4 (Red), color b (Cyan), color f (White)\r\n\r\n`);
      }
      break;

    case 'theme':
      if (args[0] && themeMap[args[0].toLowerCase()]) {
        const hex = themeMap[args[0].toLowerCase()];
        socket.emit('change_color', hex);
        socket.emit('output', `\r\n[OK] Theme changed to '${args[0]}'\r\n\r\n`);
      } else {
        socket.emit('output', `\r\nUsage: theme <matrix|classic|cyber|ubuntu>\r\n\r\n`);
      }
      break;

    case 'git':
      if (args[0] === 'clone') {
        const repo = args[1] || '';
        socket.emit('output', `\r\nCloning into '${repo.split('/').pop() || 'repository'}'...\r\nremote: Enumerating objects: 42, done.\r\nremote: Total 42 (delta 18), reused 42\r\nReceiving objects: 100% (42/42), done.\r\nResolving deltas: 100% (18/18), done.\r\n\r\n`);
      } else if (args[0] === 'status') {
        socket.emit('output', `\r\nOn branch main\r\nYour branch is up to date with 'origin/main'.\r\n\r\nnothing to commit, working tree clean\r\n\r\n`);
      } else {
        socket.emit('output', `\r\nGit over SSH Quick Reference:\r\n  git clone git@github.com:JunDevX/UseSimulateSSH.git\r\n  git status\r\n\r\nFor full docs visit: http://localhost:3000/git\r\n\r\n`);
      }
      break;

    case 'help':
      socket.emit('output', `\r\nAvailable SSH Commands & Utilities:\r\n` +
        `-------------------------------------------------------------------------\r\n` +
        `  color <code|0-f>             Change text color (color 2 = Green, color 4 = Red)\r\n` +
        `  theme <matrix|classic|cyber> Change terminal color theme preset\r\n` +
        `  help                         Show this help manual\r\n` +
        `  missions                     View active security tasks\r\n` +
        `  ls / dir                     List directory contents\r\n` +
        `  cd <dir>                     Change directory\r\n` +
        `  pwd                          Print current path\r\n` +
        `  cat <file>                   Read file contents\r\n` +
        `  grep <pattern> <file>        Filter text\r\n` +
        `  set-config <key> <val>       Modify /etc/ssh/sshd_config\r\n` +
        `  iptables -A INPUT -s IP -j DROP Block IP\r\n` +
        `  iptables -L                  List firewall rules\r\n` +
        `  audit-check                  Evaluate system protection\r\n` +
        `  git clone <url>              Simulate cloning Git over SSH\r\n` +
        `  whoami / id                  Show user info\r\n` +
        `  clear                        Clear screen\r\n` +
        `  exit                         Disconnect\r\n\r\n` +
        `Docs Links: /edu (General Docs) | /git (Git SSH Manual)\r\n\r\n`);
      break;

    case 'missions':
      socket.emit('output', `\r\n[ACTIVE SECURITY MISSIONS]\r\n` +
        `1. Inspect /var/log/auth.log and locate attacking IP\r\n` +
        `2. Block attacker: iptables -A INPUT -s <IP> -j DROP\r\n` +
        `3. Disable root login: set-config PermitRootLogin no\r\n` +
        `4. Change default port: set-config Port 2222\r\n` +
        `5. Run 'audit-check' to verify\r\n\r\n`);
      break;

    case 'pwd':
      socket.emit('output', `\r\n${currentDir}\r\n\r\n`);
      break;

    case 'dir':
    case 'ls':
      if (currentDir === '/root' || currentDir === '/home/student') {
        socket.emit('output', `\r\nnotes.txt  auth.log  sshd_config.bak  UseSimulateSSH/\r\n\r\n`);
      } else if (currentDir === '/var/log') {
        socket.emit('output', `\r\nauth.log  syslog  dpkg.log\r\n\r\n`);
      } else {
        socket.emit('output', `\r\ntotal 0\r\n\r\n`);
      }
      break;

    case 'cd':
      const target = args[0] || '~';
      if (target === '~' || target === '/root') {
        updatedDir = (user === 'root') ? '/root' : '/home/student';
      } else if (target === '/var/log' || target === '/etc/ssh') {
        updatedDir = target;
      } else if (target === '..') {
        updatedDir = '/';
      } else {
        socket.emit('output', `\r\nbash: cd: ${target}: No such file or directory\r\n\r\n`);
      }
      break;

    case 'cat':
      let pathArg = args[0] || '';
      if (pathArg.includes('auth.log')) {
        socket.emit('output', `\r\n${db.logs.join('\r\n')}\r\n\r\n`);
      } else if (pathArg.includes('sshd_config')) {
        let cfgStr = Object.entries(db.sshd_config).map(([k, v]) => `${k} ${v}`).join('\r\n');
        socket.emit('output', `\r\n# SSH Server Configuration\r\n${cfgStr}\r\n\r\n`);
      } else {
        socket.emit('output', `\r\ncat: ${pathArg || 'file'}: No such file or directory\r\n\r\n`);
      }
      break;

    case 'grep':
      if (args.length < 2) {
        socket.emit('output', `\r\nUsage: grep <pattern> <file>\r\n\r\n`);
      } else {
        let lines = args[1].includes('auth.log') ? db.logs : Object.entries(db.sshd_config).map(([k, v]) => `${k} ${v}`);
        const matched = lines.filter(l => l.toLowerCase().includes(args[0].toLowerCase()));
        socket.emit('output', `\r\n${matched.length > 0 ? matched.join('\r\n') : 'No matches found.'}\r\n\r\n`);
      }
      break;

    case 'set-config':
      if (args.length < 2) {
        socket.emit('output', `\r\nUsage: set-config <Option> <Value>\r\n\r\n`);
      } else {
        db.sshd_config[args[0]] = args[1];
        saveDatabase();
        logEvent('CONFIG_CHANGE', `sshd_config: ${args[0]} = ${args[1]}`);
        socket.emit('output', `\r\n[OK] Updated /etc/ssh/sshd_config: ${args[0]} ${args[1]}\r\n\r\n`);
      }
      break;

    case 'iptables':
      if (args[0] === '-L') {
        let rules = db.blocked_ips.map(ip => `DROP       all  --  ${ip.padEnd(20)} 0.0.0.0/0`).join('\r\n');
        socket.emit('output', `\r\nChain INPUT (policy ACCEPT)\r\ntarget     prot opt source               destination\r\n${rules || ' (none)'}\r\n\r\n`);
      } else if (args[0] === '-A' && args[1] === 'INPUT' && args[2] === '-s' && args[4] === '-j' && args[5] === 'DROP') {
        const targetIp = args[3];
        if (!db.blocked_ips.includes(targetIp)) {
          db.blocked_ips.push(targetIp);
          saveDatabase();
          logEvent('FIREWALL_ADD', `IP ${targetIp} dropped`);
          socket.emit('output', `\r\n[OK] Rule added: DROP traffic from ${targetIp}\r\n\r\n`);
        } else {
          socket.emit('output', `\r\nIP ${targetIp} already blocked.\r\n\r\n`);
        }
      } else {
        socket.emit('output', `\r\nUsage: iptables -L OR iptables -A INPUT -s <IP> -j DROP\r\n\r\n`);
      }
      break;

    case 'audit-check':
      let score = 0;
      let report = [];

      if (db.sshd_config.PermitRootLogin === 'no') { score++; report.push(' [PASS] Root Login Disabled'); }
      else { report.push(' [FAIL] Root Login is ENABLED (Insecure)'); }

      if (parseInt(db.sshd_config.Port) !== 22) { score++; report.push(' [PASS] Default SSH Port Changed'); }
      else { report.push(' [FAIL] SSH running on default Port 22 (Insecure)'); }

      if (db.blocked_ips.length > 0) { score++; report.push(` [PASS] Active Firewall Blocking Enabled (${db.blocked_ips.length} IPs)`); }
      else { report.push(' [FAIL] No offending IPs blocked via iptables'); }

      socket.emit('output', `\r\n=== SECURITY AUDIT EVALUATION REPORT ===\r\n` + report.join('\r\n') + `\r\n----------------------------------------\r\nScore: ${score}/3 completed.\r\n\r\n`);
      break;

    case 'whoami':
      socket.emit('output', `\r\n${user}\r\n\r\n`);
      break;

    case 'exit':
      socket.emit('output', '\r\nConnection closed by foreign host.\r\n');
      socket.disconnect();
      break;

    default:
      socket.emit('output', `\r\nCommand '${cmd}' not recognized. Type 'help' for available actions.\r\n\r\n`);
      break;
  }

  callback(updatedDir);
}

server.listen(PORT, () => {
  console.log(`[UseSimulateSSH] Engine running on http://localhost:${PORT}`);
});