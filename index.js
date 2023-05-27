const express = require("express");
const api = express();
const fs = require("fs");
const cors = require("cors");
const rimraf = require("rimraf");
const { kill } = require("process");
const PORT = 8080;
const defaultJavaPath = "/bin/java";

let data = JSON.parse(fs.readFileSync("data.json", "utf-8"));
let killerbank = [];
api.use(express.json());
api.use(cors());

if (!fs.existsSync("data.json")) {
    fs.writeFileSync("data.json", JSON.stringify({javapath: defaultJavaPath, servers: []}));
}
if (!fs.existsSync("jars")) {
    fs.mkdirSync("jars");
}
if (!fs.existsSync("servers")) {
    fs.mkdirSync("servers");
}

function serverEntryExists(id) {
    for (let i = 0; i < data.servers.length; i++) {
        if (Number(data.servers[i].id) == id) {
            return i;
        }
    }
    return false;
}

function jarExists(jarname) {
    const jars = fs.readdirSync("jars/");
    for (let i = 0; i < jars.length; i++) {
        if (jars[i] == jarname) {
            return true;
        }
    }
    return false;
}

api.get("/", function (req, res) {
    console.log("GET / FROM " + req.socket.remoteAddress);
    res.status(200).send({
        servers: data.servers,
        jars: fs.readdirSync("jars/")
    });
});

api.post("/start", function (req, res) {
    console.log("POST /start FROM " + req.socket.remoteAddress);
    const { id } = req.query;
    if (!id) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    const ex = serverEntryExists(Number(id));
    if (ex === false) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    let proc = require("child_process").spawn(data.javapath, ["-jar", "../../jars/" + data.servers[ex].jar], {
        cwd: "servers/" + id + "/",
        stdio: "ignore"
    });
    killerbank.push({
        id: Number(id),
        proc: proc
    });
    res.status(204).send();
});

api.post("/kill", function (req, res) {
    console.log("POST /kill FROM " + req.socket.remoteAddress);
    const { id } = req.query;
    if (!id) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    const ex = serverEntryExists(Number(id));
    if (ex === false) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    let isAlive = false;
    let j;
    for (let i = 0; i < killerbank.length; i++) {
        if (killerbank[i].id == Number(id)) {
            isAlive = true;
            j = i;
            break;
        }
    }
    if (!isAlive) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    killerbank[j].proc.kill("SIGINT");
    killerbank.splice(j, 1);
    res.status(204).send();
});

api.post("/shutdown", function (req, res) {
    console.log("POST /shutdown FROM " + req.socket.remoteAddress);
    for (let i = 0; i < killerbank.length; i++) {
        killerbank[i].proc.kill("SIGINT");
    }
    res.status(204).send();
    console.log("Shutdown called by " + req.socket.remoteAddress);
    process.exit(0);
});

api.post("/new", function (req, res) {
    console.log("POST /new FROM " + req.socket.remoteAddress);
    const { name, jar, rconpwd } = req.body;
    if (!name || !jar || !rconpwd || !jarExists(jar)) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    const id = data.servers.length;
    const path = "servers/" + id.toString();
    const serverport = 25565 + id;
    const rconport = 25575 + id;
    fs.mkdirSync(path);
    const prop = "server-port=" + serverport.toString() + "\nenable-rcon=true\nrcon.port=" + rconport.toString() + "\nrcon.password=" + rconpwd + "\nmotd=" + name;
    fs.writeFileSync(path + "/server.properties", prop);
    fs.writeFileSync(path + "/eula.txt", "eula=true");
    data.servers.push({
        id: id,
        name: name,
        jar: jar,
        rconpwd: rconpwd
    });
    fs.writeFileSync("data.json", JSON.stringify(data));
    res.status(201).send({
        id: id
    });
});

api.post("/del", function (req, res) {
    console.log("POST /del FROM " + req.socket.remoteAddress);
    const { id } = req.query;
    if (!id) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    const ex = serverEntryExists(Number(id));
    if (ex === false) {
        res.status(400).send({
            message: "400 Malformed request"
        });
        return;
    }
    data.servers.splice(ex, 1);
    fs.writeFileSync("data.json", JSON.stringify(data));
    rimraf.sync("servers/" + id);
    res.status(204).send();
});

api.listen(PORT, function () {
    console.log("Listening on " + PORT.toString() + "\n");
});