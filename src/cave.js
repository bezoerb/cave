'use strict';

const fs = require('fs');
const _ = require('lodash');
const css = require('css');

function api(stylesheet, options) {
  let sheet;
  if (fs.existsSync(stylesheet)) {
    sheet = css.parse(read(stylesheet));
  } else {
    sheet = css.parse(stylesheet);
  }
  const sheetRules = sheet.stylesheet.rules;
  const removables = css.parse(options.css);

  removables.stylesheet.rules.forEach(inspectRule);
  _.forEachRight(sheetRules, removeEmptyMedia);

  return result();

  function inspectRule(inspected, parent) {
    const simpler = omitRulePosition(inspected);
    const forEachVictim = typeof parent === 'number';
    if (forEachVictim) {
      parent = false;
    }
    if (inspected.type === 'rule') {
      if (parent) {
        _.chain(sheetRules)
          .filter({type: 'media', media: parent.media})
          .map('rules')
          .value()
          .forEach(removeMatches);
      } else {
        removeMatches(sheetRules);
      }
    } else if (inspected.type === 'media') {
      inspected.rules.forEach(inspectRuleInMedia);
    }

    function inspectRuleInMedia(rule) {
      inspectRule(rule, inspected);
    }

    function removeMatches(rules) {
      _.remove(rules, perfectMatch); // Remove perfect matches
      _.filter(rules, byDeclarations).forEach(stripSelector); // Strip selector from partial matches
      _.filter(rules, bySelector).forEach(stripDeclarations); // Strip declarations from partial matches
      _.remove(rules, noDeclarations);
    }

    function perfectMatch(rule) {
      return _.isEqual(omitRulePosition(rule), simpler);
    }

    function noDeclarations(rule) {
      return rule.type === 'rule' && _.filter(rule.declarations, {type: 'declaration'}).length === 0;
    }

    function byDeclarations(rule) {
      return _.isEqual(omitRulePosition(rule).declarations, simpler.declarations);
    }

    function bySelector(rule) {
      return _.isEqual(omitRulePosition(rule).selectors, simpler.selectors);
    }

    function stripSelector(rule) {
      rule.selectors = _.difference(rule.selectors, inspected.selectors);
    }

    function stripDeclarations(rule) {
      rule.declarations = _.differenceWith(omitRulePosition(rule).declarations, simpler.declarations, _.isEqual);
    }
  }

  function removeEmptyMedia(rule, i) {
    if (rule.type === 'media' && rule.rules.length === 0) {
      sheetRules.splice(i, 1);
    }
  }

  function result() {
    return css.stringify(sheet) + '\n';
  }
}

function omitPosition(declaration) {
  return _.omit(declaration, 'position');
}

function omitRulePosition(rule) {
  if (rule.type !== 'rule') {
    return false;
  }
  const result = omitPosition(rule);
  result.declarations = result.declarations.map(omitPosition);
  return result;
}

function read(file) {
  return fs.readFileSync(file, {encoding: 'utf8'});
}

module.exports = api;
