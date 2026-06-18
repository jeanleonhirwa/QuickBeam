const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const execAsync = promisify(exec);

class WifiCommands {
  static async checkHostedNetworkSupport() {
    try {
      const { stdout } = await execAsync('netsh wlan show drivers', { timeout: 10000 });
      return stdout.includes('Hosted network supported  : Yes') ||
             stdout.includes('Hosted network supported : Yes');
    } catch (err) {
      console.error('Check hosted network error:', err.message);
      return false;
    }
  }

  static getDeviceName() {
    const hostname = os.hostname().replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `QB_${hostname}_${random}`;
  }

  static generatePassword() {
    return 'qb' + Math.random().toString(36).substring(2, 10);
  }

  static async createHostedNetwork(ssid, password) {
    try {
      await execAsync(`netsh wlan set hostednetwork mode=allow ssid="${ssid}" key="${password}"`, { timeout: 10000 });
      return true;
    } catch (err) {
      console.error('Create hosted network error:', err.message);
      throw new Error('Failed to create hosted network: ' + err.message);
    }
  }

  static async startHostedNetwork() {
    try {
      await execAsync('netsh wlan start hostednetwork', { timeout: 10000 });
      return true;
    } catch (err) {
      console.error('Start hosted network error:', err.message);
      throw new Error('Failed to start hosted network: ' + err.message);
    }
  }

  static async stopHostedNetwork() {
    try {
      await execAsync('netsh wlan stop hostednetwork', { timeout: 10000 });
    } catch (e) {
      // Ignore - may not be running
    }
  }

  static async getHostedNetworkStatus() {
    try {
      const { stdout } = await execAsync('netsh wlan show hostednetwork', { timeout: 10000 });
      const status = stdout.includes('Status                  : Started') ||
                     stdout.includes('Status : Started');
      const clients = this.parseClientCount(stdout);
      const ssidMatch = stdout.match(/SSID name\s*:\s*(.+)/);
      return {
        status,
        clients,
        ssid: ssidMatch ? ssidMatch[1].trim().replace(/"/g, '') : null
      };
    } catch (err) {
      return { status: false, clients: 0, ssid: null };
    }
  }

  static parseClientCount(output) {
    const match = output.match(/Number of clients\s*:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  static async connectToNetwork(ssid, password) {
    const profileXml = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${ssid}</name>
  <SSIDConfig>
    <SSID>
      <name>${ssid}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${password}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>`;

    const profilePath = path.join(os.tmpdir(), 'qb_profile.xml');
    fs.writeFileSync(profilePath, profileXml);

    try {
      await execAsync(`netsh wlan add profile filename="${profilePath}"`, { timeout: 10000 });
      await execAsync(`netsh wlan connect name="${ssid}"`, { timeout: 10000 });

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 3000));

      return await this.isConnected(ssid);
    } catch (err) {
      console.error('Connect to network error:', err.message);
      return false;
    } finally {
      try { fs.unlinkSync(profilePath); } catch (e) {}
    }
  }

  static async isConnected(ssid) {
    try {
      const { stdout } = await execAsync('netsh wlan show interfaces', { timeout: 10000 });
      return stdout.includes(ssid);
    } catch (err) {
      return false;
    }
  }

  static async disconnect() {
    try {
      await execAsync('netsh wlan disconnect', { timeout: 10000 });
    } catch (e) {
      // Ignore
    }
  }

  static getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  static async getWifiInterfaces() {
    try {
      const { stdout } = await execAsync('netsh wlan show interfaces', { timeout: 10000 });
      const interfaces = [];
      const lines = stdout.split('\n');
      let current = null;

      for (const line of lines) {
        if (line.includes('Interface name') || line.includes('Name')) {
          if (current) interfaces.push(current);
          current = { name: line.split(':')[1]?.trim() };
        }
        if (current) {
          if (line.includes('State')) current.state = line.split(':')[1]?.trim();
          if (line.includes('SSID')) current.ssid = line.split(':')[1]?.trim();
          if (line.includes('Signal')) current.signal = line.split(':')[1]?.trim();
        }
      }
      if (current) interfaces.push(current);

      return interfaces;
    } catch (err) {
      return [];
    }
  }
}

module.exports = WifiCommands;
