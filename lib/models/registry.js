const { registerCardModel } = require('./Card');
const { registerPlayModel } = require('./Play');
const { registerSwipeOnlyPlayModel } = require('./SwipeOnlyPlay');
const { registerSwipeMorePlayModel } = require('./SwipeMorePlay');
const { registerVoteMorePlayModel } = require('./VoteMorePlay');
const { registerRankOnlyPlayModel } = require('./RankOnlyPlay');
const { registerRankMorePlayModel } = require('./RankMorePlay');
const { registerIntelligenceSnapshotModel } = require('./IntelligenceSnapshot');
const { registerPlayFeedbackEventModel } = require('./PlayFeedbackEvent');
const { registerPlayFeedbackAggregateModel } = require('./PlayFeedbackAggregate');

function registerOrgModels(connection) {
  return {
    Card: registerCardModel(connection),
    IntelligenceSnapshot: registerIntelligenceSnapshotModel(connection),
    PlayFeedbackEvent: registerPlayFeedbackEventModel(connection),
    PlayFeedbackAggregate: registerPlayFeedbackAggregateModel(connection),
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
