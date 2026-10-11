# Safe Automaton — RankGeo.dev

Razvojni prototip za istraživanje javnih poslovnih prilika, procenu izvodljivosti i pripremu isporuka uz obaveznu ljudsku kontrolu.

## Stranice

- `index.html` — kontrolna tabla, lokalna evidencija i budžetski limit.
- `opportunities.html` — ručno pokretana pretraga javnih izvora poslova i poziva.
- `workbench.html` — procena isplativosti, radni zadaci, nacrti ponuda, ručno odobravanje i praćenje isporuke/naplate.
- `execution-lab.html` — kontrolisani lokalni šabloni za izradu radnih artefakata, ručni QA, čuvanje i izvoz Markdown/JSON rezultata; nije povezan sa AI modelom i ne izvršava proizvoljan kod.

## Obavezna pravila

- **Ovlašćena potrošnja: 0 EUR.** Nema plaćenih API-ja, pretplata ili automatskog trošenja novca.
- **Svaka ponuda zahteva izričito korisničko odobrenje.** Aplikacija je ne šalje; odobrenje samo označava nacrt kao spreman za ručno slanje van aplikacije.
- Nema automatskog prihvatanja ugovora, prijava, poruka, plaćanja ili upravljanja nalogom na platformi.
- Ne zaobilaziti prijave, CAPTCHA, paywall, ograničenja učestalosti ili pravila izvora.
- Pre slanja proveriti uslove platforme, podobnost iz Srbije, obim posla, rok, kriterijume prihvatanja, prava na rezultat i naplatu.
- Ocena 1–100 je heuristička procena na osnovu unetih pretpostavki, a ne garancija da će posao biti dobijen, završen или наплаћен.

## Trenutne mogućnosti

- Prenosiva biblioteka skill-procedura: `skills/seo-audit/SKILL.md`, `skills/copywriting/SKILL.md` i `skills/customer-research/SKILL.md`. Ovo su instrukcije za budući runtime, nisu još povezane sa automatskim AI izvršavanjem; primenjuju pravila 0 EUR, proverljivih izvora i zabrane spoljnih radnji.

- Opportunity Hunter: ručno preuzimanje sa trenutno povezanih javnih izvora; rezultati i istraživačke prilike čuvaju se u `localStorage`.
- Task Workbench: procena neto zarade po satu, sposobnosti, roka, šanse za dobijanje posla i rizika.
- Execution Lab: SEO evidence audit sa prioritetnim sledećim koracima, plus odvojene ručne QA kontrolne liste za SEO, istraživanje, tehnički QA i plan isporuke. Kontrolne liste ne znače da je zadatak autonomno izvršen.
- Generisanje i čuvanje nacrta ponude; izričito odobrenje za ručno slanje; izvoz teksta.
- Praćenje faza zadatka: procena, prihvatanje ponude, izrada, provera kvaliteta, isporuka, potvrda rezultata i ručno evidentiranje naplate.
- JSON izvoz za rezervnu kopiju.

## Trenutna ograničenja — važno

- Ovo još nije autonomni AI izvršilac: nema povezivanja AI modela, израде резултата клијентског посла у sandbox-у, тестирања кода у изолованом окружењу, интеграције са платним сервисима или аутоматске испоруке.
- Позадинска претрага 24/7/365 није имплементирана. Opportunity Hunter се тренутно покреће ручно; стални распоред мора бити засебно пројектован и проверен у оквиру бесплатних квота.
- Подаци у `localStorage` доступни су само истом прегледачу/домену и нису синхронизовани између уређаја. Извези JSON као резервну копију.
- Одобрење понуде у Workbench-у не шаље ништа. Статус „Плаћено” је само ручна евиденција и није банковна потврда.
- Нема гаранције прихода; огласи, услови, рокови и изводљивост морају се проверити на извору.

## Развојни приоритети

1. Тестирати Opportunity Hunter у прегледачу и поправити евентуалне грешке.
2. Проверити Task Workbench у прегледачу, укључујући одобрење понуде, JSON/TXT извоз и опоравак од неважећих података.
3. Додати трајно чување података на серверу само ако је могуће у оквиру одобреног буџета и са одговарајућом аутентификацијом.
4. Изабрати један мали тип задатка и изградити ограничен, проверљив execution sandbox без приступа тајнама или неконтролисаног извршавања.
5. Дизајнирати периодичну претрагу и праћење рокова у оквиру стварних квота бесплатног hosting-а; не обећавати непрекидност док није тестирана.
6. Свака интеграција са платформом или платним сервисом захтева засебну проверу правила и експлицитно одобрење корисника.


## Опциони Workers AI нацрти (подразумевано искључени)

- Endpoint: `POST /api/ai-task`; подржани типови су `seo`, `research`, `qa` и `scope`.
- Модел: `@cf/zai-org/glm-4.7-flash`, преко Cloudflare Pages Functions binding-а `AI`.
- Нема спољног API кључа, али inference користи Cloudflare Workers AI квоту. Бесплатна квота и доступност модела могу да се промене.
- Endpoint одбија позиве док `SAFE_AUTOMATON_AI_ENABLED` није експлицитно постављен на `true`, binding `AI` није додат и Cloudflare secret `SAFE_AUTOMATON_AI_TOKEN` (најмање 32 знака) није подешен. Сваки захтев мора послати тај токен у заглављу `X-Safe-Automaton-AI-Token`; UI га не чува. Нема аутоматског fallback-а на плаћени API.
- **За строги буџет 0 EUR:** не укључивати док Cloudflare налог није потврђен на Workers Free плану и док није проверено да је модел доступан у бесплатном режиму. На Workers Paid плану употреба преко дневне бесплатне квоте може бити наплаћена. Апликација сама не може да гарантује да налог неће наплатити прекорачење.
- Постављање `SAFE_AUTOMATON_AI_ENABLED=true`, додавање binding-а `AI` и тајне `SAFE_AUTOMATON_AI_TOKEN` су ручни кораци у Cloudflare подешавањима; овај commit не мења налог, binding, продукцију нити покреће inference.
- Захтев је ограничен на 12 KB; тип задатка је allowlist; endpoint нема веб-претраживање нити алате; сваки одговор је означен као непроверен нацрт за људски преглед.
- Тестови користе mock AI binding и не троше Workers AI квоту.

## Локално покретање

Отвори `index.html` у модерном прегледачу или постави статичке датотеке на развојни Cloudflare Pages preview. Ова промена је намењена искључиво развојној грани `phase-0-1-safe-research-foundation`; не мења продукцију сама по себи.

## Лиценца

Није дефинисана у овој почетној верзији.
