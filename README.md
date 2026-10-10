# Safe Automaton — RankGeo.dev

Bezbedan, statički prototip za planiranje poslovnih hipoteza, eksperimenata i budžeta.

## Trenutne funkcije

- Dashboard sa početnim budžetskim limitom od 100 EUR.
- Ručna evidencija troškova.
- Tri početne poslovne hipoteze za tržišnu validaciju.
- Dodavanje, označavanje i brisanje eksperimentalnih zadataka.
- Izvoz lokalnih podataka u JSON.
- Čuvanje podataka u `localStorage` ovog pregledača.

## Bezbednosne granice

Ova verzija ne povezuje AI model i ne izvršava spoljašnje radnje. Nema novčanika, automatskih transakcija, shell izvršavanja, kloniranja, samostalne izmene koda ili automatskog objavljivanja. Ne unosite API ključeve ili druge tajne.

Podaci se čuvaju lokalno u pregledaču; obrišite ih samo ako ste sigurni ili prethodno napravite izvoz. Budžetski limit je evidencija, ne bankarska kontrola niti stvarno ograničenje potrošnje.

## Lokalno pokretanje

Otvorite `index.html` u modernom pregledaču. Za Cloudflare Pages statički prototip može da se objavi direktno iz repozitorijuma, bez build komande, uz izlazni direktorijum koji sadrži `index.html`.

## Plan narednih faza

1. Proveriti funkcije u pregledaču i ispraviti eventualne probleme.
2. Validirati poslovne hipoteze razgovorima sa stvarnim korisnicima.
3. Izabrati jednu usku uslugu tek kada postoje dokazi potražnje.
4. Povezati AI preko serverske komponente uz zaštitu ključeva, ograničenja troškova i ljudsko odobravanje rizičnih radnji.

Nema garancije prihoda. Početne hipoteze i njihove oznake su okvirne, nisu dokaz tržišne potražnje.

## Licenca

Nije definisana u ovoj početnoj verziji.
