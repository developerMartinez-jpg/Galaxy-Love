import l1 from './letters-1.js'
import l2 from './letters-2.js'

export const PLANET_COUNT = 50

export const PLANET_NAMES = [
  'Luminara', 'Aurelia', 'Petalune', 'Memoria', 'Heartsong',
  'Velvetia', 'Serenity', 'Candoria', 'Joyara', 'Blushara',
  'Kismet', 'Cuddlia', 'Honeydew', 'Starlace', 'Twilight Rose',
  'Whisperia', 'Amberlyn', 'Moonbloom', 'Sugarplum', 'Evermore',
  'Longing', 'Dreamweaver', 'Vowhaven', 'Stardrift', 'Nostalgia',
  'Cloudberry', 'Lullaby', 'Wishara', 'Promisia', 'Midnyra',
  'Horizonia', 'Evergreen', 'Harborlight', 'Seedling', 'Bloomfield',
  'Compass Rose', 'Homeward', 'Lanternfall', 'Chosenia', 'Aeterna',
  'Depthara', 'Infinita', 'Solstice', 'Sanctuary', 'Saphyra',
  'Ardent', 'Oasis', 'Constellara', 'Beloved', 'Everlove'
]

export const FINAL_LETTER = {
  title: 'MY FAVOURITE UNIVERSE IS YOU 💜',
  body: `We made it through all 50 planets, but if there is one thing I want you to remember, it is that you are my favourite part of this entire universe.

Every planet represented a little reason why I love you, every letter held a piece of my heart, and every moment spent discovering them was meant to remind you how special you are to me.

I wish I could give you every star in the sky, every sunset, every beautiful place and every little thing that makes you smile.

These three gifts are just a small way of showing you how much I want to make you happy.

And if I could start this journey all over again, I would choose you, every single time.

You are my favourite person, my favourite story and my favourite universe.

I love you more than words could ever explain. ❤️`
}

// planets 1..49 come from the two letter files, planet 50 is the final letter.
export const LETTERS = [...l1, ...l2].map(([title, body]) => ({ title, body })).concat([FINAL_LETTER])

export const GIFTS = [
  {
    id: 1, kind: 'decoration', label: 'GIFT 1 — DECORATION 🏡',
    title: 'A LITTLE PIECE OF MAGIC',
    body: 'A little surprise to make your space even more beautiful, cozy and special. Because you deserve to have beautiful things surrounding you.'
  },
  {
    id: 2, kind: 'roses', label: 'GIFT 2 — ROSES 🌹',
    title: 'A THOUSAND ROSES FOR YOU',
    body: 'Because no amount of flowers could ever express how beautiful you are to me. These roses are just a little reminder of how much I adore you.'
  },
  {
    id: 3, kind: 'travel', label: 'GIFT 3 — TRAVEL ✈️',
    title: 'AN ADVENTURE JUST FOR US',
    body: 'A special trip together, full of new memories, beautiful places, laughter, kisses and moments that we will remember forever. Because my favourite destination will always be wherever you are.'
  }
]

export const FINALE_TEXT = {
  headline: 'YOU MADE IT TO THE END OF MY UNIVERSE ❤️',
  intro: '50 planets. 50 little pieces of my heart. And one person who makes my whole universe worth exploring. If I could give you the entire universe, I would. But for now, I have three special surprises for you...',
  ending: 'THE END OF THE 50 PLANETS... BUT NEVER THE END OF OUR STORY. ❤️'
}

if (LETTERS.length !== PLANET_COUNT) {
  throw new Error(`Expected ${PLANET_COUNT} letters, found ${LETTERS.length}`)
}
if (PLANET_NAMES.length !== PLANET_COUNT) throw new Error('Expected 50 planet names')
