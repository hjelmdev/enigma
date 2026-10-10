/** Player-facing Swedish copy for the prologue (draft, editable for pacing). */
export const TEXT = {
  title: {
    tagline: 'Ett mysterium väntar under sanden',
    newGame: 'Nytt spel',
    continue: 'Fortsätt',
    settings: 'Inställningar',
    confirmNew: 'Ett sparat äventyr finns redan. Vill du börja om från början?',
    confirmYes: 'Börja om',
    confirmNo: 'Avbryt',
  },
  settings: {
    title: 'Inställningar',
    reduceMotion: 'Minska rörelser (ingen skakning, mindre damm)',
    largeText: 'Större text',
    resetSave: 'Radera sparat spel',
    resetDone: 'Det sparade spelet är raderat.',
    experiments: 'Öppna tidigare experiment',
    close: 'Stäng',
  },
  captions: {
    attic:
      'Längst in på farfars vind stod en låda som ingen hade öppnat på många år.',
    miniature:
      'I den låg en liten pyramid av mörk sten. Ytan var slät. Vinklarna nästan omöjligt exakta.',
    inspectHint: 'Dra för att vrida på miniatyren. Titta på alla sidor.',
    noteIntro: 'Under pyramiden låg en hopvikt lapp med farfars handstil.',
    travel:
      'Tecknen ledde långt bort – till en pyramid som nästan försvunnit ur historien.',
    arrival:
      'Här fanns samma mönster, inhuggna i sten som inte rörts på århundraden.',
    firstHint: 'Farfars sista rad dröjer sig kvar: ”När ljuset finner ögat …”',
    opened:
      'Ett dovt ljud skär genom tystnaden. Stenen rör sig. Bakom den väntar mörkret.',
    takeBack: 'Du lyfter försiktigt tillbaka miniatyren ur bronsvaggan.',
    solved: 'Ljuset finner ögat.',
  },
  note: {
    lines: [
      'Jag har letat efter dess like hela mitt liv.',
      'Sök platsen där de gamla tecknen återkommer.',
      'När ljuset finner ögat öppnas vägen.',
    ],
    signature: '– Farfar',
    showTranscript: 'Visa som tryckt text',
    showHandwriting: 'Visa handstil',
    title: 'Farfars lapp',
  },
  ui: {
    next: 'Fortsätt',
    skip: 'Hoppa över',
    skipIntro: 'Hoppa över intro',
    back: 'Tillbaka',
    close: 'Stäng',
    menu: 'Meny',
    note: 'Farfars lapp',
    artifact: 'Miniatyren',
    recenter: 'Centrera vyn',
    hint: 'Tips',
    look: 'Dra för att se dig omkring',
    turnLeft: 'Vrid åt vänster',
    turnRight: 'Vrid åt höger',
    tiltUp: 'Luta uppåt',
    tiltDown: 'Luta nedåt',
    rotateHint: 'Dra för att vrida miniatyren i vaggan',
    enter: 'Gå in',
    toTitle: 'Till titelskärmen',
    goOutside: 'Gå tillbaka ut',
  },
  hints: [
    'Titta på ögat ovanför ingången. Det ligger i skugga.',
    'Miniatyren har en blank linje som löper från ögat upp mot toppen. Vänd den mot solen.',
    'När en ljusstråle syns: vrid och luta långsamt tills strålen träffar det huggna ögat.',
  ],
  hotspots: {
    stele: {
      label: 'Stenstele',
      text: 'En sten med tre inhuggna tecken. Du känner igen dem – de finns på miniatyrens sidor.',
    },
    ruins: {
      label: 'Kolonner',
      text: 'Fallna kolonner. Någon byggde mer här än bara pyramiden.',
    },
    eye: {
      label: 'Det huggna ögat',
      text: 'Ett öga, inhugget ovanför ingången. Det ligger i skugga – solen når inte hit.',
      textSolved: 'Ögat glöder fortfarande svagt, som om stenen minns ljuset.',
    },
    frieze: {
      label: 'Tecken över ingången',
      text: 'Fyra tecken i rad. Exakt samma som på miniatyrens fyra sidor.',
    },
    door: {
      label: 'Stenblocket',
      text: 'Fogarna runt det här blocket är märkligt raka, nästan som en ram.',
    },
    pedestal: {
      label: 'Piedestalen',
      text: 'En piedestal står i full sol. Bronsvaggan i toppen har exakt samma form som miniatyrens bas.',
      action: 'Placera miniatyren',
      textSolved: 'Vaggan står tom igen. Solen glittrar i bronsen.',
    },
    jeep: {
      label: 'Jeepen',
      text: 'Jeepen står där du lämnade den. Vattnet räcker till i kväll.',
    },
    passage: {
      label: 'Den öppna gången',
      text: 'Sval luft strömmar ut ur mörkret. Någonstans långt där inne glimmar ett blåaktigt ljus.',
    },
  },
  gate: {
    title: 'Kapitel 1 · Entréhallen',
    body: 'Du kliver in i den svala gången. Fortsättningen – den första salen – är under utformning.',
  },
} as const;
