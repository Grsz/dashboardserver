const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const { config, verifyKey } = require("./db");
const db = require('knex')(config);
const fs = require('fs');
const fileUpload = require('express-fileupload');
const jsonwebtoken  = require('jsonwebtoken');


const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(fileUpload());
app.get('/', (req, res => {
    res.status(200).send()
}))
app.post('/checktoken', (req, res) => {
    const { token } = req.body;
    const decoded = jsonwebtoken.verify(token, verifyKey);
    if(decoded.username){
        const { username } = decoded;
        db('users').where({username})
            .then(user => userData = user[0])
            .then(() => db("images").where({username}).select("imgname")
                .then(images => userData.images = images.map(obj => obj.imgname))
                .then(() => db("tasks").where({username})
                    .then(tasks => userData.tasks = tasks.sort((a, b) => Number(a.completed) - Number(b.completed)))
                    .then(() => res.json(userData))
                )
            )
            .catch(err => res.status(400).json('unable to get user'))
    } else {
        res.status(400).json('token not found')
    }
})
app.post('/signin', (req, res) => {
    const {
        password,
        username
    } = req.body;
    db('users').where('username', username)
        .select('hash')
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash);
            if (isValid) {
                let userData;
                const token = jsonwebtoken.sign({username}, verifyKey)
                db('users').where({username})
                    .then(user => userData = {...user[0], token})
                    .then(() => db("images").where({username}).select("imgname")
                        .then(images => userData.images = images.map(obj => obj.imgname))
                        .then(() => db("tasks").where({username})
                            .then(tasks => userData.tasks = tasks.sort((a, b) => Number(a.completed) - Number(b.completed)))
                            .then(() => res.json(userData))
                        )
                    )
                    .catch(err => res.status(400).json('Unable to get user'))
            } else {
                res.status(400).json('The data you entered is invalid')
            }
        })
        .catch(err => res.status(400).json('The data you entered is invalid'))
})
app.post('/register', (req, res) => {
    const {
        email,
        username,
        password,
        passwordConfirm
    } = req.body;
    let profimg;
    if(req.files){
        profimg = req.files.profimg;
    } else {
        profimg = "";
    }
    if (password === passwordConfirm) {
        const hash = bcrypt.hashSync(password);
        if (Boolean(profimg)) {
            const dir = '../public/images/' + username + "/";
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }
            profimg.mv(dir + profimg.name, err => {
                if (err) {
                    console.log(err)
                }
            });
        }
        db('users')
            .insert({
                email,
                hash,
                username,
                profimg: profimg ? profimg.name : null
            })
            .returning('*')
            .then(user => {
                res.json(user[0]);
            })
            .catch(err => res.status(400).json('Unable to register'))
    } else {
        res.status(400).json("Passwords aren't matching")
    }
})
app.post('/upload', (req, res) => {
    const { username } = req.body;
    const { file } = req.files;
    if (!file)
      return res.status(400).send('No files were uploaded.');
      const dir = '../public/images/' + username + "/";
      if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
      }
    file.mv(dir + file.name, err => {
        if(err){console.log(err)}
        db('images').insert({
            imgname: file.name,
            username
        })
        .then(() => db('images').where({username}))
        .then(images => res.json(images.map(obj => obj.imgname)))
        .catch(err => console.log(err))
    });
  });
app.post('/newtask', (req, res) => {
    const { username, name } = req.body;
    db('tasks').insert({username, name})
    .returning('*')
    .then(task => res.json(task[0]))
    .catch(err => console.log(err))
})
app.post('/switchcompleted', (req, res) => {
    const { completed, id } = req.body;
    db('tasks').where({id})
    .update({completed})
    .returning('*')
    .then(task => res.json(task[0]))
    .catch(err => console.log(err))
})
app.post('/newtaskname', (req, res) => {
    const { newName, id } = req.body;
    db('tasks').where({id})
    .update({name: newName})
    .returning('*')
    .then(task => res.json(task[0]))
    .catch(err => console.log(err))
})
app.listen(process.env.PORT || 3001, () => {
    console.log(`app is running on port ${process.env.PORT || 3001}`)
})