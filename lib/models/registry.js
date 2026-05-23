const { registerCardModel } = require('./Card');
const { registerPlayModel } = require('./Play');
const { registerSwipeOnlyPlayModel } = require('./SwipeOnlyPlay');
const { registerSwipeMorePlayModel } = require('./SwipeMorePlay');
const { registerVoteMorePlayModel } = require('./VoteMorePlay');
const { registerRankOnlyPlayModel } = require('./RankOnlyPlay');
const { registerRankMorePlayModel } = require('./RankMorePlay');

function registerOrgModels(connection) {
  return {
    Card: registerCardModel(connection),
    Play: registerPlayModel(connection),
    SwipeOnlyPlay: registerSwipeOnlyPlayModel(connection),
    SwipeMorePlay: registerSwipeMorePlayModel(connection),
    VoteMorePlay: registerVoteMorePlayModel(connection),
    RankOnlyPlay: registerRankOnlyPlayModel(connection),
    RankMorePlay: registerRankMorePlayModel(connection),
  };
}

module.exports = {
  registerOrgModels,
};
