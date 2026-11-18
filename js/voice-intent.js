/* Orbit voice, part one: turning words into a short list of allowed actions.
   The words are read here first (clear commands like "take me to wander" or "open @yourname");
   anything this can't read goes to the voice-intent function, where Claude Haiku answers in the same shape.
   Whatever comes back, from here or from Claude, passes checkActions: unknown actions and odd slots are dropped,
   so nothing outside the allowlist can ever run. Changes (following someone) are marked so the bar asks first.
   Loaded in the page (window.OrbitVoiceIntent) and in Node for scripts/check-voice-intent.mjs. */
(function (root) {
  'use strict';

  // Where "go to" can take you. Depth stops 0–3 are the four places; the rest open panels.
  const PLACES = ['orbit', 'friends', 'wander', 'ether', 'settings', 'help', 'notifications'];
  // What each action may carry, and whether it changes anything (changes always wait for a second yes).
  const ACTIONS = {
    go_to: { change: false },
    back: { change: false },
    open_profile: { change: false },
    ether_search: { change: false },
    ether_refine: { change: false },
    save_item: { change: true },
    ether_tune: { change: false },
    ether_shape: { change: false },
    ether_move: { change: false },
    open_tune: { change: false },
    refresh: { change: false },
    show_help: { change: false },
    find_help: { change: false },
    play_song: { change: false },
    stop_song: { change: false },
    follow: { change: true },
    unfollow: { change: true }
  };
  const MOST_ACTIONS = 3;
  const MOST_WORDS = 60;

  const PLACE_WORDS = [
    [/\b(?:my\s+)?orbit\b|\bhome\b|\bmy page\b/, 'orbit'],
    [/\bfriends?\b|\bcosmos\b/, 'friends'],
    [/\bwander(?:ing)?\b/, 'wander'],
    [/\b(?:the\s+)?ether\b/, 'ether'],
    [/\bsettings?\b|\baccount\b/, 'settings'],
    [/\bhelp\b|\bhow (?:it|orbit) works\b|\bguide\b/, 'help'],
    [/\bnotifications?\b/, 'notifications']
  ];

  const clean = (value) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const short = (value) => clean(value).slice(0, MOST_WORDS);

  // A person as said: "@yourname", "yourname's orbit", "mia chen". Spoken handles lose their shape
  // ("hues of saturn"), so the bar also tries the words pushed together.
  function personWords(text) {
    return short(String(text)
      .replace(/[’']s\b/g, '')
      .replace(/\b(?:orbit|profile|page|planet)\b\s*$/i, '')
      .replace(/^(?:the\s+)?(?:orbit|profile|page)\s+of\s+/i, '')
      .replace(/[.!?,]+$/, ''));
  }

  function placeIn(text) {
    const words = text.replace(/^(?:the|my)\s+/, '');
    for (const [pattern, place] of PLACE_WORDS) if (pattern.test(words) && words.replace(pattern, '').replace(/\b(?:the|my|page|place|please|now)\b/g, '').trim() === '') return place;
    return '';
  }

  // Where things live in orbit, for "how do i…" and "where is…" questions. Each topic's words are matched whole;
  // the first topic with the most matches wins. The star (orbit-voice.js) says the answer and opens the spot.
  const HELP_TOPICS = [
    ['agents', /\b(?:agents?|claude|chatgpt|gpt|connector|mcp|ai|assistant|hook (?:up|it up)|connect (?:my |an |a )?(?:agent|ai|claude))\b/g],
    ['download', /\b(?:download|export|backup|back up|copy of my orbit)\b/g],
    ['username', /\b(?:username|user name|handle|my name|change my name|display name)\b/g],
    ['email', /\b(?:email|e-mail|password|log ?in|sign ?in|login)\b/g],
    ['account_type', /\b(?:business|personal|account type)\b/g],
    ['blocked', /\b(?:block(?:ed)?|unblock)\b/g],
    ['notifications', /\b(?:notifications?|alerts?)\b/g],
    ['source', /\b(?:sources?|pinterest|are\.?na|cosmos|spotify|apple music|youtube|substack|instagram|behance|shopify|boards?|channels?|link (?:a|my)|add (?:images|pictures))\b/g],
    ['photos', /\b(?:upload|my photos|my pictures|add (?:a |my )?(?:photo|picture)s?)\b/g],
    ['face', /\b(?:face|portrait|selfie|picture of me|photo of me|my centre|my center)\b/g],
    ['ring', /\b(?:rings?|arrange|who (?:can )?sees?)\b/g],
    ['sky', /\b(?:sky|stars?|zodiac|birth|chart|astrology|constellations?)\b/g],
    ['mood', /\b(?:mood(?: orbits?)?)\b/g],
    ['guide', /\b(?:how (?:it|orbit|this) works|what is orbit|explain orbit|the big picture|tour)\b/g],
    ['feedback', /\b(?:feedback|bug|problem|broken|suggest(?:ion)?|report a)\b/g],
    ['test', /\b(?:test orbit|tester|checklist|help test)\b/g]
  ];
  const HELP_IDS = HELP_TOPICS.map(([id]) => id);
  function findTopic(text) {
    const t = clean(text).toLowerCase();
    let best = '', most = 0;
    for (const [id, pattern] of HELP_TOPICS) {
      const hits = (t.match(pattern) || []).length;
      if (hits > most) { best = id; most = hits; }
    }
    return best;
  }
  // "how do i…", "where is…", "can i…", "help me…", "i want to…": a question about where something lives.
  const ASKING = /^(?:how (?:do|can|could|would|should|to|does)\b|where\b|can i\b|could i\b|is there\b|i want to\b|i'?d like to\b|i need to\b|help me\b|show me how\b|what about\b|settings for\b)|\b(?:how do i|how can i|where do i|where can i|where is|where are|where'?s)\b/;

  // One clause ("take me to the ether", "open @mia", "back") → one action, or null when it isn't a clear command.
  function readClause(raw) {
    const text = clean(raw).toLowerCase().replace(/[.!?]+$/, '').replace(/^(?:please|can you|could you|hey orbit|orbit)\s+/, '').replace(/\s+please$/, '');
    if (!text) return null;
    if (/^(?:go\s+)?back$|^take me back$|^undo that$/.test(text)) return { type: 'back' };
    // "how do i connect my agent", "where do i change my password", "can i hook up claude": where it lives.
    if (ASKING.test(text)) {
      const topic = findTopic(text);
      if (topic) return { type: 'find_help', words: topic };
    }
    // "save this", "add it to my orbit", "keep this one", "save this to my orbit".
    if (/^(?:save|add|keep|pull)(?:\s+(?:this|it|that|this one|that one|the (?:photo|picture|image|one)))?(?:\s+(?:to|into|in)\s+(?:my|the)\s+orbit)?$/.test(text)) return { type: 'save_item' };
    // "play the song", "play it", "play music"; "stop the song", "pause", "stop the music".
    if (/^(?:play|start)(?:\s+(?:the|this|that|it))?(?:\s+(?:song|music|track|preview))?$/.test(text) && text !== 'start') return { type: 'play_song' };
    if (/^(?:stop|pause)(?:\s+(?:the|this|that|it))?(?:\s+(?:song|music|track|preview))?$/.test(text)) return { type: 'stop_song' };
    // Follow-ups to an Ether search: "only bowls", "show me older ones", "any colour", "newer".
    // Chatty follow-ups: "can you just show me the blue ones", "what about older ones", "only the bowls please".
    // Drop the filler; if a few words are left and they name a colour, material or type (or older/newer), it's a follow-up.
    if (!/^(?:search|find|open|go|take|follow|unfollow|stop orbiting|play|save|add|enter|visit|show me @|tune|retune|set|change|make|switch|turn|shape|drift|move|dive|refresh|reload|clear|reset|untune|deeper)/.test(text)) {
      const core = text.replace(/\b(?:can you|could you|would you|please|now|ok|okay|what about|how about|show me|give me|i want|i only want|just|only|the|ones?|instead|then|them)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (/^(?:older|newer|earlier|later)$/.test(core)) return { type: 'ether_refine', words: core };
      if (core && core.split(' ').length <= 3 && window_like_facet(core)) return { type: 'ether_refine', words: short(`only ${core}`) };
    }
    if (/^(?:only|just)\s+\S/.test(text) || /^(?:show me |just |now )?(?:the )?(?:older|newer|earlier|later)(?: ones| things| pieces)?$/.test(text)
      || /^(?:any|without(?: the)?|drop(?: the)?|forget(?: the)?|no)\s+(?:colou?r|material|dates?|time|period|type)$/.test(text)) {
      return { type: 'ether_refine', words: short(text) };
    }

    let match = /^(?:un-?follow|stop (?:orbiting|following))\s+(.+)$/.exec(text);
    if (match) return { type: 'unfollow', person: personWords(match[1]) };
    match = /^(?:follow|orbit|start orbiting)\s+(.+)$/.exec(text);
    if (match && !placeIn(match[1])) return { type: 'follow', person: personWords(match[1]) };

    // The Ether's own controls. "tune to red" sets Tune's colour (it never searches); shape, deeper and refresh press
    // the same buttons as the dock. Plain "back" stays a move between places; in the Ether the star treats it as the dock's back.
    if (/^(?:help|what can (?:you|i) (?:do|say|ask)|how does (?:this|it) work|what do you do|what is this)$/.test(text)) return { type: 'show_help' };
    if (/^(?:open\s+)?(?:the\s+)?tune(?:\s+panel)?$/.test(text)) return { type: 'open_tune' };
    if (/^(?:clear|reset|remove|undo|turn off)(?:\s+the)?\s+tun(?:e|ing)$|^untune$/.test(text)) return { type: 'ether_tune', words: 'clear' };
    match = /^(?:tune|retune)(?:\s+(?:it|the ether|this))?(?:\s+(?:to|for|in|into|by))?\s+(.+)$/.exec(text)
      || /^(?:set|change|make)\s+(?:the\s+)?(?:colou?r|time|era|source)\s+(?:to\s+)?(.+)$/.exec(text);
    if (match) return { type: 'ether_tune', words: short(match[1]) };
    match = /^(?:(?:change|switch|set|turn)(?:\s+(?:the|it))?(?:\s+shape)?(?:\s+(?:to|into))?|shape(?:\s+(?:to|it))?|make it(?:\s+(?:a|the))?|show (?:it as|me)(?:\s+(?:a|the))?)?\s*(drift|horizon|well|planet)(?:\s+shape)?$/.exec(text);
    if (match) return { type: 'ether_shape', words: match[1] };
    if (/^(?:go\s+|drift\s+|move\s+|dive\s+)?(?:deeper|further(?:\s+in)?)$/.test(text)) return { type: 'ether_move', words: 'deeper' };
    if (/^(?:drift|move|float)\s+back(?:wards)?$/.test(text)) return { type: 'ether_move', words: 'back' };
    if (/^(?:refresh|reload)(?:\s+(?:it|this|the ether|wander|my orbit|the page))?$|^(?:show me\s+)?new (?:ones|images|pictures)$/.test(text)) return { type: 'refresh' };

    match = /^search(?:\s+(?:in\s+)?(?:the\s+)?ether)?(?:\s+(?:for|to))?\s+(.+)$/.exec(text);
    if (match && !/^(?:the\s+)?ether$/.test(match[1])) return { type: 'ether_search', words: short(match[1]) };

    match = /^(?:take me to|go to|open|show(?: me)?|bring me to|head to|visit|enter|jump to|back to|switch to)\s+(.+)$/.exec(text);
    const target = match ? match[1] : text;
    const place = placeIn(target);
    if (place) return { type: 'go_to', place };

    // "open @mia", "show me mia's orbit", "enter liz's orbit", "find sam", "look up brandon".
    match = /^(?:open|show(?: me)?|visit|enter|go to|take me to|find|look up|look for|who is)\s+(.+)$/.exec(text);
    if (match) {
      const said = match[1];
      if (/^@/.test(said) || /[’']s\s+(?:orbit|profile|page|planet)$/.test(said) || /^(?:find|look up|look for|who is)/.test(text)) {
        const person = personWords(said);
        if (person.replace(/^@/, '').length >= 2) return { type: 'open_profile', person };
      }
    }
    if (/^@[\w.\-]{2,}$/.test(text)) return { type: 'open_profile', person: text };
    return null;
  }

  // A follow-up like "only the blue ones" names a colour, material or type the Ether search knows.
  const FACET_WORDS = /\b(?:red|vermilion|orange|amber|yellow|olive|green|mint|teal|aqua|sky|blue|navy|indigo|violet|plum|magenta|pink|brown|black|grey|gray|white|purple|ceramic|porcelain|glass|silver|gold|bronze|wood|silk|wool|cotton|paper|ivory|jade|marble|leather|dish(?:es)?|bowls?|plates?|cups?|vases?|jars?|teapots?|jugs?|tiles?|figures?|dress(?:es)?|coats?|hats?|shoes?|fans?|chairs?|mirrors?|clocks?|textiles?|maps?|posters?|prints?|photographs?|paintings?|drawings?)\b/;
  function window_like_facet(text) { return FACET_WORDS.test(text); }

  // "take me to the ether and search red dishes" → two clauses. A lone "and" inside search words stays put
  // ("search salt and pepper") because only "and then", "then" and "and" before a known command split.
  const COMMAND_START = '(?:take me|go|open|show|search|tune|find|look|follow|unfollow|enter|visit|back|bring me|head|switch|save|add|play|stop|change|set|make|refresh|drift)';
  function splitClauses(text) {
    return clean(text).split(new RegExp(`\\s*(?:,\\s*)?(?:\\band then\\b|\\bthen\\b|\\band\\b(?=\\s+${COMMAND_START}\\b))\\s*`, 'i')).filter(Boolean);
  }

  // The local reader: every clause must be clear, or the whole sentence goes to Claude instead.
  function readCommand(text) {
    const words = clean(text);
    if (!words) return { actions: [], understood: false };
    const actions = splitClauses(words).map(readClause);
    const understood = actions.length > 0 && actions.every(Boolean);
    return { actions: understood ? checkActions(actions) : [], understood };
  }

  // The allowlist. Anything else (another action, extra fields, a place we don't have) is dropped.
  function checkActions(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const item of list) {
      if (!item || typeof item !== 'object' || !Object.prototype.hasOwnProperty.call(ACTIONS, item.type)) continue;
      const kind = ACTIONS[item.type];
      if (item.type === 'go_to') {
        if (PLACES.includes(item.place)) out.push({ type: 'go_to', place: item.place, change: kind.change });
      } else if (['back', 'save_item', 'play_song', 'stop_song'].includes(item.type)) {
        out.push({ type: item.type, change: kind.change });
      } else if (item.type === 'find_help') {
        const topic = HELP_IDS.includes(String(item.words || '').trim()) ? String(item.words).trim() : findTopic(item.words);
        if (topic) out.push({ type: 'find_help', words: topic, change: kind.change });
      } else if (['open_tune', 'refresh', 'show_help'].includes(item.type)) {
        out.push({ type: item.type, change: kind.change });
      } else if (item.type === 'ether_shape') {
        const shape = String(item.words || '').toLowerCase().trim();
        if (['drift', 'horizon', 'well', 'planet'].includes(shape)) out.push({ type: 'ether_shape', words: shape, change: kind.change });
      } else if (item.type === 'ether_move') {
        const way = String(item.words || '').toLowerCase().trim();
        if (['deeper', 'back'].includes(way)) out.push({ type: 'ether_move', words: way, change: kind.change });
      } else if (['ether_search', 'ether_refine', 'ether_tune'].includes(item.type)) {
        const words = short(item.words);
        if (words) out.push({ type: item.type, words, change: kind.change });
      } else {
        const person = short(item.person).replace(/^@+/, '@');
        if (person.replace(/^@/, '').length >= 2) out.push({ type: item.type, person, change: kind.change });
      }
      if (out.length >= MOST_ACTIONS) break;
    }
    return out;
  }

  // How the bar names an action back to you, in Orbit's lowercase voice.
  const PLACE_NAMES = { orbit: 'your orbit', friends: 'friends', wander: 'wander', ether: 'the ether', settings: 'settings', help: 'how it works', notifications: 'notifications' };
  function describe(action) {
    switch (action.type) {
      case 'go_to': return `go to ${PLACE_NAMES[action.place]}`;
      case 'back': return 'go back';
      case 'open_profile': return `find ${action.person}`;
      case 'ether_search': return `search the ether: ${action.words}`;
      case 'ether_refine': return `narrow the search: ${action.words}`;
      case 'save_item': return 'save this to your orbit';
      case 'ether_tune': return action.words === 'clear' ? 'clear the tune' : `tune the ether to ${action.words}`;
      case 'ether_shape': return `shape: ${action.words}`;
      case 'ether_move': return action.words === 'deeper' ? 'drift deeper' : 'drift back';
      case 'open_tune': return 'open tune';
      case 'refresh': return 'refresh';
      case 'show_help': return 'what i can do';
      case 'find_help': return `where to find: ${action.words}`;
      case 'play_song': return 'play the song';
      case 'stop_song': return 'stop the song';
      case 'follow': return `orbit ${action.person}`;
      case 'unfollow': return `stop orbiting ${action.person}`;
      default: return '';
    }
  }

  // Ways to ask for one person: as said, without spaces ("hues of saturn" → "huesofsaturn"), without dots.
  function searchTerms(person) {
    const said = clean(person).replace(/^@/, '').toLowerCase();
    const joined = said.replace(/\s+/g, '');
    return [...new Set([said, joined].filter((term) => term.length >= 2))];
  }

  // Names as people write them on their planets: accents dropped and stylised letters read as letters
  // ("$am" → "sam", "j0hn" → "john", "Zoë" → "zoe"), so a plain spoken or typed name still finds them.
  const STYLISED = { '$': 's', '5': 's', '@': 'a', '4': 'a', '0': 'o', '3': 'e', '1': 'i', '!': 'i', '7': 't', '|': 'l' };
  function plainName(text) {
    return clean(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[$5@40317!|]/g, (ch) => STYLISED[ch]).replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Who someone means, without guessing: friends you orbit first, then the directory (which already hides
  // blocked people both ways). An exact username or one match opens; several show choices; none says so.
  // Two people with the same name always give choices, even when one's username is that name run together.
  function choosePerson(person, friends, found) {
    const said = clean(person).replace(/^@/, '').toLowerCase();
    const joined = said.replace(/\s+/g, '');
    const key = (entry) => entry.user_id || entry.followed_user_id;
    const named = (entry) => plainName(entry.display_name);
    const heard = plainName(said);
    const username = (entry) => String(entry.username || '').toLowerCase();
    const exact = (entry) => username(entry) === said || username(entry) === joined;
    // A friend's name matches from the start of any word, as "find a friend" and the directory do ("sam" finds Sam Ortiz).
    const byName = (entry) => Boolean(heard) && (named(entry) === heard || named(entry).split(' ').some((word) => word.startsWith(heard)));
    const everyone = new Map();
    (friends || []).filter((entry) => exact(entry) || byName(entry))
      .forEach((entry) => everyone.set(key(entry), { ...entry, user_id: key(entry), friend: true }));
    (found || []).forEach((entry) => { if (!everyone.has(key(entry))) everyone.set(key(entry), { ...entry, user_id: key(entry), friend: false }); });
    const list = [...everyone.values()];
    if (!list.length) return { none: true };
    const sameName = list.filter((entry) => named(entry) && named(entry) === heard);
    if (sameName.length > 1) return { choices: [...new Set([...sameName, ...list.filter(exact)])].slice(0, 8) };
    const exactFriend = list.filter((entry) => entry.friend && exact(entry));
    if (exactFriend.length === 1) return { pick: exactFriend[0], friend: true };
    const exactAll = list.filter(exact);
    if (exactAll.length === 1) return { pick: exactAll[0], friend: exactAll[0].friend };
    if (list.length === 1) return { pick: list[0], friend: list[0].friend };
    return { choices: list.slice(0, 8) };
  }

  const api = { PLACES, ACTIONS, HELP_IDS, findTopic, plainName, readCommand, readClause, checkActions, describe, searchTerms, choosePerson, splitClauses };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitVoiceIntent = api;
})(typeof window !== 'undefined' ? window : globalThis);
