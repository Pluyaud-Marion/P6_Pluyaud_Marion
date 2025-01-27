//importation bcrypt pour hasher password
const bcrypt = require('bcrypt');

//importation cryptoJS pour crypter email
const cryptojs = require('crypto-js');

//importation dotenv
const dotenv = require('dotenv');
dotenv.config();

//importation jsonwebtoken pour générer le token
const jwt = require('jsonwebtoken');

//importation http-status
const status = require('http-status');

//importation du modèle User
const User = require('../models/User');


/*
fonction signup 
--> chiffre email + hash password + ajoute l'user à db
*/
exports.signup = (req, res, next) => {
    //chiffrer l'email avant de l'envoyer dans la base de données
    const emailCryptoJs = cryptojs.HmacSHA256(req.body.email, `${process.env.CRYPTOJS_EMAIL}`).toString();
    const SALT_NUMBER = 10
    bcrypt.hash(req.body.password, SALT_NUMBER)
    .then(hash => {
        const user = new User ({
            email : emailCryptoJs,
            password : hash
        });
        user.save()
        .then(() => res.status(status.CREATED).json({message : 'Utilisateur créé et sauvegardé'}))

        .catch(error => res.status(status.BAD_REQUEST).json({error}));
    })
    .catch(error => res.status(status.INTERNAL_SERVER_ERROR).json({error}));
};

/*
fonction login
->chiffre email de la requête et cherche si existe dans les emails chiffrés de la db
->si email non existant = erreur
->si email existant = compare avec bcrypt string du password avec db
->si password KO = erreur
->si password OK = renvoi l'userId contenu dans db + un token qui comprend userid / clé chiffrement / expiration 24h
*/
exports.login = (req, res, next) => {
    //chiffrer email de la requête pour comparaison avec db
    const emailCryptoJs = cryptojs.HmacSHA256(req.body.email, `${process.env.CRYPTOJS_EMAIL}`).toString();

    //chercher dans la db si utilisateur est présent et retourne promesse
    User.findOne({email : emailCryptoJs})

    //si le mail de l'user n'est pas présent -> il n'existe pas dans la base
    .then(user => {
        if(!user){
            return res.status(status.UNAUTHORIZED).json({error : "utilisateur inexistant"})
        }

        //controler la validité du password
        bcrypt.compare(req.body.password, user.password) // compare chaine de caractère en clair avec la chaine hashée
            .then(verifPassword => { 
                //si mot de passe incorrect (si renvoi false)
                if (!verifPassword){
                    return res.status(status.UNAUTHORIZED).json({error : "Le mot de passe est incorrect"})
                }else { // si mot de pass correct -> envoi dans la response du serveur de l'user id + du token
                    res.status(status.OK).json({ 
                        //encodage du userId pour création de nouveaux objets (objets et userId liés)
                        userId : user._id, //_id contenu dans user précédent
                        token : jwt.sign( // 3 arguments
                            {userId : user._id}, // payload
                            `${process.env.KEY_TOKEN}`,
                            {expiresIn: "24h"}
                        )
                    });
                }
            })
            .catch(error => res.status(status.INTERNAL_SERVER_ERROR).json({error}));
    })
    .catch(error => res.status(status.INTERNAL_SERVER_ERROR).json({error}));
};