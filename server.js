// require dependencies
var express = require("express");
var mongoose = require("mongoose");
var axios = require("axios");
var cheerio = require("cheerio");
var bodyParser = require("body-parser");
var exphbs = require("express-handlebars");

var port = process.env.PORT || 8000;

// initialize Express
var app = express();

// use body-parser for handling form submissions
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json({
    type: "application/json"
}));

// serve the public directory
app.use(express.static("public"));

//Set up promises with mongoose
mongoose.Promise = Promise;

mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost/scraperNews");

var db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection error:"));

db.once("open", function () {
    console.log("Connected to Mongoose!");
});

// use handlebars
app.engine("handlebars", exphbs({
    defaultLayout: "main"
}));
app.set("view engine", "handlebars");


// Hook mongojs configuration to the db variable
var db = require("./models");

//Routes

// A GET route for scraping the website and place it into the mongodb db
app.get("/scrape", function (req, res) {
    // First, we grab the body of the html with axios
    axios.get("https://www.npr.org/sections/technology/").then(function (response) {
        // Load the html body from axios into cheerio and save it to $ for a shorthand selector
        var $ = cheerio.load(response.data);

        // Now, we grab every 'article' tag within 'div' with 'g-regular-story' class, and do the following:
        $("article").each(function (i, element) {

            // Create an empty result object
            var result = {};

            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this)
                .find("h2")
                .text();
            result.link = $(this)
                .find("h2")
                .children("a")
                .attr("href");
            result.summary = $(this)
                .find("p")
                .children("a")
                .text();

            // if these are present in the scraped data, create an article in the database collection
            // Create a new Article using the `result` object built from scraping
            if (result.title && result.link && result.summary) {
                db.Article.create(result)
                    .then(function (dbArticle) {
                        // View the added result in the console
                        console.log(dbArticle);
                    })
                    .catch(function (err) {
                        // If an error occurred, log it
                        console.log(err);
                        console.log(result);
                    });
            };
        });
        // Send a "Scrape Complete" message to the browser
        res.send("Scrape Complete");
    });

});

//Retrieve all articles from the database that are not saved and display them in the home page
app.get("/", function (req, res) {
    db.Article.find({
        saved: false
    },
        function (error, dbArticle) {
            if (error) {
                console.log(error);
            } else {
                res.render("index", {
                    articles: dbArticle
                });
            }
        })
});

// route for retrieving all the saved articles in the database.
app.get("/saved", function (req, res) {
    db.Article.find({
        saved: true
    })
        // ..and populate all of the comments associated with it
        .populate("comment")
        .then(function (dbArticle) {
            // if successful, then render with the handlebars saved page
            res.render("saved", {
                articles: dbArticle
            })
        })
        .catch(function (err) {
            // If an error occurs, send the error back to the client
            res.json(err);
        })

});
// route for setting an article to saved
app.put("/saved/:id", function (req, res) {
    db.Article.findByIdAndUpdate(
        req.params.id, {
            $set: req.body
        }, {
            new: true
        })
        .then(function (dbArticle) {
            res.render("saved", {
                articles: dbArticle
            })
        })
        .catch(function (err) {
            res.json(err);
        });
});

// Route for saving/updating an Article's associated Comment
app.post("/articles/:id", function (req, res) {
    // Create a new comment and pass the req.body to the entry
    db.Comment.create(req.body)
        .then(function (dbComment) {
            // If a Comment was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Comment
            // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
            // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
            return db.Article.findOneAndUpdate({ _id: req.params.id }, { comment: dbComment._id }, { new: true });
        })
        .then(function (dbArticle) {
            // If we were able to successfully update an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// route for saving a new comment to the db and associating it with an article
app.post("/submit/:id", function (req, res) {
    db.Comment.create(req.body)
        .then(function (dbComment) {
            var articleIdFromString = mongoose.Types.ObjectId(req.params.id)
            return db.Article.findByIdAndUpdate(articleIdFromString, {
                $push: {
                    comments: dbComment._id
                }
            })
        })
        .then(function (dbArticle) {
            res.json(dbComment);
        })
        .catch(function (err) {
            // If an error occurs, send it back to the client
            res.json(err);
        });
});
// route to find a comment by ID
app.get("/comments/article/:id", function (req, res) {
    db.Article.findOne({ "_id": req.params.id })
        .populate("comments")
        .exec(function (error, data) {
            if (error) {
                console.log(error);
            } else {
                res.json(data);
            }
        });
});

app.get("/comments/:id", function (req, res) {

    db.Comment.findOneAndRemove({ _id: req.params.id }, function (error, data) {
        if (error) {
            console.log(error);
        } else {
        }
        res.json(data);
    });
});

// listen for the routes
app.listen(port, function () {
    console.log("App is listening on PORT " + port);
});
