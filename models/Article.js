var mongoose = require("mongoose");

// save a reference to the Schema constructor
var Schema = mongoose.Schema;

// create a new article schema. The link should be unique, but the other properties are not required because they may not exist on the website to be scraped. There is validation on the route to add them to the database on if these properties exist.
var ArticleSchema = new Schema({
  title: {
    type: String,
    require: false
  },
  link: {
    type: String,
    unique: true,
    require: false
  },
  summary: {
    type: String,
    require: false
  },
  saved: {
    type: Boolean,
    default: false
  },
  comments: [
    {
      type: Schema.Types.ObjectId,
      ref: "Comment"
    }
  ]
});

// create model
var Article = mongoose.model("Article", ArticleSchema);

// export the model
module.exports = Article;