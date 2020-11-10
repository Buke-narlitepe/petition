const express = require("express");
const exphbs = require("express-handlebars");
const db = require("./db.js");
const cookieSession = require("cookie-session");
const csurf = require("csurf");
const bcrypt = require("bcryptjs");

const app = express();

app.engine("handlebars", exphbs());
app.set("view engine", "handlebars");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
    cookieSession({
        secret: "We are the champions!",
        maxAge: 5 * 365 * 24 * 60 * 60 * 1000, // 5 year
    })
);

app.use(csurf());

// must come after the csurf middleware
app.use(function (req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// THIS WILL PREVENT US FROM CLICKJACKING
app.use((req, res, next) => {
    res.setHeader("x-frame-options", "deny");
    next();
});

app.get("/", (req, res) => {
    if (req.session.signed) {
        res.redirect("/thank-you");
    } else if (!req.session.user_id) {
        res.redirect("/register");
    } else {
        res.render("home");
    }
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    if (
        req.body.firstname &&
        req.body.lastname &&
        req.body.email &&
        req.body.password
    ) {
        bcrypt
            .hash(req.body.password, 10)
            .then((hash) => {
                return db.createUser(
                    req.body.firstname,
                    req.body.lastname,
                    req.body.email,
                    hash
                );
            })
            .then((value) => {
                req.session.user_id = value.rows[0].id;
                req.session.firstname = value.rows[0].firstname;
                res.redirect("/profile");
            })
            .catch(() => {
                res.render("register", {
                    error: true,
                });
            });
    } else {
        res.render("register", {
            error: true,
        });
    }
});

app.get("/login", (req, res) => {
    if (!req.session.user_id) {
        res.render("login");
    } else {
        res.redirect("/");
    }
});

app.post("/login", (req, res) => {
    if (req.body.email) {
        db.getUserByEmail(req.body.email).then((value) => {
            bcrypt
                .compare(req.body.password, value.rows[0].password)
                .then((match) => {
                    if (match) {
                        req.session.user_id = value.rows[0].id;
                        req.session.firstname = value.rows[0].firstname;
                        res.redirect("/");
                    } else {
                        res.render("/login", {
                            error: true,
                        });
                    }
                });
        });
    }
});

app.get("/profile", (req, res) => {
    res.render("profile");
});

app.post("/profile", (req, res) => {
    if (req.body.homepage) {
        if (!req.body.homepage.startsWith("http")) {
            res.render("profile", { error: true });
        }
    }
    db.createProfile(
        req.body.age,
        req.body.city,
        req.body.homepage,
        req.session.user_id
    ).then(() => {
        res.redirect("/");
    });
});

app.get("/signers", (req, res) => {
    db.getSigners().then((data) => {
        res.render("signers", {
            signatures: data.rows,
        });
    });
});

app.get("/signers/:city", (req, res) => {
    const city = req.params.city;
    db.getSigners(city).then((data) => {
        res.render("signers", { signatures: data.rows });
    });
});

app.post("/sign-petition", (req, res) => {
    if (req.body.signature && req.session.user_id) {
        db.addSignature(req.body.signature, req.session.user_id).then(
            (value) => {
                req.session.user_id = value.rows[0].id;
                req.session.signed = true;
                res.redirect("/thank-you");
            }
        );
    } else {
        res.render("home", {
            error: true,
        });
    }
});
app.get("/thank-you", (req, res) => {
    if (req.session.signed) {
        console.log(req.session.user_id);

        db.getSignatureById(req.session.user_id).then((data) => {
            console.log(data.rows[0]);

            res.render("thank", {
                signature: data.rows[0].signature,
            });
        });
    } else {
        res.redirect("/");
    }
});

app.get("/logout", function (req, res) {
    req.session.user_id = null;
    res.redirect("/login");
});

app.listen(3000, () => {
    console.log("PETITION IS LISTENING...");
});