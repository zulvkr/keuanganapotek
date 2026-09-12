import { spawn } from "node:child_process";
import net from "node:net";

const defaultApiPort = 3000;
const defaultWebPort = 5173;

function parsePort(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return { value: fallback, explicit: false };
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return { value: port, explicit: true };
}

function canListen(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      server.close();
      if (error.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function isAvailable(port) {
  for (const host of ["0.0.0.0", "::", "127.0.0.1", "::1"]) {
    try {
      if (!(await canListen(port, host))) return false;
    } catch (error) {
      if (error?.code !== "EADDRNOTAVAIL" && error?.code !== "EINVAL") throw error;
    }
  }
  return true;
}

async function choosePort(config, label, excludedPorts = []) {
  if (config.explicit) {
    if (excludedPorts.includes(config.value)) throw new Error(`${label} port ${config.value} conflicts with another dev service`);
    if (!(await isAvailable(config.value))) throw new Error(`${label} port ${config.value} is already in use`);
    return config.value;
  }

  for (let port = config.value; port <= 65535; port += 1) {
    if (excludedPorts.includes(port)) continue;
    if (await isAvailable(port)) return port;
  }
  throw new Error(`No available ${label} port found`);
}

const apiPort = await choosePort(parsePort("API_PORT", defaultApiPort), "API");
const webPort = await choosePort(parsePort("WEB_PORT", defaultWebPort), "web", [apiPort]);
const childEnv = {
  ...process.env,
  API_PORT: String(apiPort),
  WEB_PORT: String(webPort),
  VITE_API_URL: process.env.VITE_API_URL || `http://127.0.0.1:${apiPort}`,
};
const children = [
  spawn("pnpm", ["--filter", "@keuangan-apotek/api", "run", "dev"], { env: childEnv, stdio: "inherit", windowsHide: true }),
  spawn("pnpm", ["--filter", "@keuangan-apotek/web", "run", "dev"], { env: childEnv, stdio: "inherit", windowsHide: true }),
];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250);
}

for (const child of children) child.once("exit", (code, signal) => {
  if (!shuttingDown) {
    console.error(`Dev process stopped (${signal ?? `exit ${code ?? 1}`}).`);
    shutdown(code ?? 1);
  }
});
process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

console.log(`Dev web: http://127.0.0.1:${webPort}`);
console.log(`Dev API: http://127.0.0.1:${apiPort}`);
