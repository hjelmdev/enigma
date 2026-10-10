/** Player-facing Swedish copy for Chapter 1 (draft, editable for pacing). */
export const HALL_TEXT = {
  corridor: {
    enter:
      'Gången sluttar svagt nedåt. Dagsljuset bakom dig blir svagare för varje steg.',
    forward: 'Gå vidare',
    toHall: 'Gå in i salen',
    back: 'Gå tillbaka ut',
    inscriptionLabel: 'Inskriptioner',
    inscription:
      'Samma fyra tecken som på miniatyren, om och om igen, som en bön längs väggarna. Någon ville att den som kom hit skulle känna igen dem.',
    farLabel: 'Ljuset längre fram',
    far: 'Längst fram öppnar sig gången. Ett varmt sken blandas med något kallare, blåare.',
  },
  hall: {
    title: 'Kapitel 1 · Den stora hallen',
    arrival:
      'Gången mynnar ut i en väldig sal. Pelare försvinner upp i mörkret och taket glittrar av guldstjärnor. Någon har tänt eldarna här – eller så har de aldrig slocknat.',
    arrivalLook: 'Dra för att se dig omkring i salen',
    pedestalGlow:
      'I mitten av salen står en piedestal i en ljusstrimma. Något i din väska känns plötsligt varmt.',
  },
  hotspots: {
    pedestal: {
      label: 'Piedestalen',
      text: 'En sockel av brons med en grop formad exakt som miniatyrens topp. Ljuset från taket faller rakt på den.',
      action: 'Håll fram miniatyren',
      awakened:
        'Miniatyren svarar fortfarande när du håller den nära. Den minns vägen du gått.',
    },
    niche: {
      label: 'Den stora reliefen',
      text: 'En pyramid inhuggen i väggen, och inuti den ett virrvarr av gångar – samma mönster som på miniatyrens undersida.',
      textAwake:
        'De gyllene linjerna i reliefen glöder svagt. Pyramiden på väggen är en karta, precis som den i din hand.',
    },
    reliefDoor: {
      label: 'Den vänstra porten',
      text: 'En mäktig stenport. Mitt på blocket är en liten pyramid med ett öga inhuggen. Ingen springa, inget handtag.',
      opened:
        'Porten har sjunkit ned i golvet. Bakom den leder en trappa ned i ett blågrönt dunkel.',
    },
    balanceDoor: {
      label: 'Den högra porten',
      text: 'Stenblocket bär en våg. Det är fastkilat i karmen – något måste lyfta det.',
      opened:
        'Blocket hänger högt uppe i taket nu. En gång stiger uppåt mot ett rödaktigt sken.',
    },
    relief: {
      label: 'Stenreliefen',
      text: 'En infälld panel med nio fält – nej, åtta. Ett är tomt. Fälten löper i spår och verkar kunna skjutas.',
      action: 'Undersök reliefen',
      solved:
        'Reliefen är hel. Den knäböjande gestalten räcker fram pyramiden mot solen.',
    },
    reference: {
      label: 'Väggmålningen',
      text: 'En målning i klara färger: en knäböjande gestalt som räcker fram en liten pyramid mot en bevingad sol. En ram av rött och blått, med gyllene rosetter i hörnen.',
    },
    balance: {
      label: 'Bronsvågen',
      text: 'En våg av brons. I ena vågskålen står ett förseglat kärl. Ovanför är tavlor med inhuggna tecken, och på en hylla ligger små vikter.',
      action: 'Undersök vågen',
      solved:
        'Vågen står i perfekt jämvikt. Låsbulten har dragits ut ur balken.',
    },
    columns: {
      label: 'Pelarna',
      text: 'Pelarna är formade som knippen av papyrus. De är så breda att du inte når runt dem med armarna.',
    },
  },
  relief: {
    title: 'Stenreliefen',
    help: 'Tryck på ett fält bredvid det tomma för att skjuta in det. Varje förflyttning kostar ett drag.',
    movesLeft: (n: number, max: number) => `Drag kvar: ${n} av ${max}`,
    reset: 'Börja om',
    confirmReset: 'Lägga tillbaka alla fält och börja om?',
    compare: 'Jämför med målningen',
    hideCompare: 'Dölj målningen',
    exhausted:
      'Stenarna glider tillbaka till sina ursprungliga platser med ett dovt muller. Alla drag är återställda.',
    solved:
      'Det sista fältet glider på plats. Ett klick hörs djupt inne i väggen.',
    back: 'Tillbaka till salen',
    noUndo:
      'Det finns inget ångra – men att skjuta tillbaka ett fält är också ett drag.',
  },
  balance: {
    title: 'Vågens hemlighet',
    help: 'Lägg vikter i den tomma vågskålen. Vågen är låst tills du drar i spaken – då avgörs om kärlet och vikterna väger lika.',
    shelf: 'Hyllan',
    pan: 'Vågskålen',
    tablets: 'Tavlorna',
    leverIdle: 'Dra spaken nedåt för att väga',
    leverButton: 'Håll in för att dra i spaken',
    leverHolding: 'Håller…',
    empty: 'Vågskålen är tom. Lägg i minst en vikt innan du drar i spaken.',
    tooLight:
      'Kärlet sjunker – vikterna var för lätta. Vågen skakar, tavlorna rämnar och nya tecken träder fram.',
    tooHeavy:
      'Vikterna dunsar ned – de var för tunga. Vågen skakar, tavlorna rämnar och nya tecken träder fram.',
    rerolled: 'Nya tecken, nya vikter och ett nytt kärl. Läs tavlorna igen.',
    solved: 'Vågen svänger, darrar … och står stilla i perfekt jämvikt.',
    back: 'Tillbaka till salen',
    kinds: {
      scarab: 'skarabé',
      falcon: 'falk',
      lotus: 'lotus',
      vessel: 'kärlet',
    },
    addLabel: (kind: string, left: number) =>
      `Lägg en ${kind} i vågskålen (${left} kvar på hyllan)`,
    removeLabel: (kind: string) => `Ta tillbaka en ${kind}`,
    relation: (left: string, right: string) =>
      `${left} väger lika mycket som ${right}`,
  },
  map: {
    title: 'Miniatyren',
    outside: 'Utsidan',
    inner: 'Inre vy',
    outer: 'Yttre vy',
    awakening:
      'Miniatyren blir varm. Ett tunt, gyllene sken sipprar ut ur fogarna – och inuti stenen tänds små rum, ett i taget.',
    awakeningDone:
      'Miniatyren är en karta. Den visar bara det du själv har sett.',
    current: 'Du är här',
    legendRoom: 'Besökt rum',
    legendClosed: 'Stängd port',
    legendOpen: 'Öppnad port',
    firstSolve: 'Miniatyren skimrar till. En ny gång har ritats in i stenen.',
    bothSolved:
      'Hela miniatyren pulserar av ljus, som ett hjärta. Två nya vägar – och fler väntar.',
    zoomIn: 'Förstora',
    zoomOut: 'Förminska',
  },
  hints: {
    start: 'Två portar och två mekanismer. Börja med vilken du vill.',
    relief:
      'Jämför stenreliefen med väggmålningen till vänster om porten. Hörnen och kanterna avslöjar var fälten hör hemma.',
    balance:
      'Läs tavlorna ovanför vågen: varje tavla visar två saker som väger lika. Byt ut det kärlet väger mot sådant som finns på hyllan.',
    done: 'Båda portarna står öppna. Vägen vidare är ännu inte byggd – men miniatyren har mer att visa.',
  },
} as const;
