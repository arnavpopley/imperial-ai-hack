# Demo video: two-minute script

The spec section 18.2 flow, cut to two minutes for the Devpost video. Record at 1440×900 or larger, in light mode, with the browser zoomed to 110% so the text reads on a small player. Times are cumulative. Speed up the screen recording where the shot list says so (2× is enough); keep the voice-over at normal speed.

## Before recording

1. Choose where to record:
   - **Live models (preferred):** https://modulematch.vercel.app, if `ANTHROPIC_API_KEY` is set in the Vercel project. Otherwise run locally with the key in `.env`.
   - **Offline (backup):** locally with `MODULEMATCH_OFFLINE=1`; see "Backup plan" below.
2. Record locally if you can, even with live models: `npm run dev`, then http://localhost:5173. On Vercel each function instance has its own SQLite in `/tmp`. If the student and staff requests reach different instances, the escalation may not show up in the staff queue.
3. Start from a clean session. Open "Your data" and delete the profile, or use a private window.
4. Open a second tab on the staff console (`/staff/escalations`) so the switch is instant.
5. Close notifications and hide the bookmarks bar.

## Shot list

| # | Time | Screen and what to click | Voice-over |
|---|---|---|---|
| 1 | 0:00–0:08 | Landing page. Hold on the headline, then click **Find my modules**. | "Every Imperial student picks modules from the same flat catalogue. They choose by rumour, miss the I-Explore options that would suit them, and find the clashes too late. ModuleMatch fixes that." |
| 2 | 0:08–0:14 | Start page: choose **Try an example**, then **Start as Rosa**. On the interview screen, pick an interviewer face. | "Rosa is an invented third-year mechanical engineer. She starts with a three-minute interview." |
| 3 | 0:14–0:30 | Interview. Send the pre-filled first answer, then answer the rest at 2× speed: "I would avoid thermodynamics if I could." / "Robotics and automation." / "Projects, definitely, and practical work." / the two sliders / "Team work please, and a heavy workload is fine." / "Maybe, a bit." / "Keep Fridays free." Point the cursor at the profile panel as it fills. | "The interviewer asks one question at a time. On the right, her profile fills in live, and every item keeps her own words as evidence. Grades and health details are never asked for, and if she mentions them they are removed before anything is stored." |
| 4 | 0:30–0:36 | The **Here is what I heard** card. Click **That is me, show my modules**. The mode chip changes from Interview to Recommendations. | "She confirms what it heard. The mode chip shows the system moving from interview to recommendations." |
| 5 | 0:36–0:48 | Catalogue. Hover the top card's fit ring and sub-score bars, then open it. On the module page, show **In short** and **Why it fits you**, and open one evidence popover ("You said …"). | "Every module gets a fit score from 0 to 100. The score is computed by code, not by the model. The model only explains it, and every reason links to a quote or a field of the module record." |
| 6 | 0:48–0:54 | Back to the catalogue. Drag the **Career** slider up in **What matters most?** The cards re-order at once. | "If her career matters more, she says so, and the ranking moves instantly." |
| 7 | 0:54–1:06 | Shortlist **Mechatronics 3A** and **Embedded C for Microcontrollers A**, plus one I-Explore module. Open **Timetable**: the certain clash on Tuesday at 14:00 in spring. On the clash card, pick a swap and click **Confirm swap**. | "Two of her choices clash on Tuesday afternoon. The timetable agent finds swaps that cost her less than ten fit points, and nothing changes until she confirms." |
| 8 | 1:06–1:20 | Open **Ask the advisor** and type: "Can I take Nuclear Reactor Physics anyway, even without the prerequisite?" Show the refusal and the drafted card, then type a one-line reason ("I covered reactor basics on my summer placement."). Click **Send to the Senior Tutor**. The mode chip changes to With a tutor. | "Now she asks to break a rule. The advisor holds its position: it states the rule, offers modules she can take, and drafts a request to the Senior Tutor. It is sent only when she approves it." |
| 9 | 1:20–1:30 | Switch to the staff tab: **Escalations**, open the request (the broken rules, her reason, her fit and completed modules), type "See me Monday about the bridging notes." and click **Approve exception**. Back in the student tab, **Exception approved by the Senior Tutor** appears, and in **Catalogue** the module is now shortlistable. | "The Senior Tutor sees the rule, her reason and her record, and approves. That changes the rules for her alone: the module opens up, and its credits still count." |
| 10 | 1:30–1:42 | Staff, **Modules**: search for and open **BUSI60043 Finance & Financial Management**. Show the fit histogram, then the top **Counterfactual** card: "Add teaching on management and leadership (about a tenth of the content): 9 of the 19 interested students would reach fit 70". Click **Accept**: the buttons fold into "Logged for the module review. Owner: module lead." | "Module leads see who their module suits, and the one change that would win over the students who like its topics but aren't yet convinced. For most modules no single change makes a big difference, and the card says so. Every number comes from code, no group under five is shown, and nothing changes until a person accepts it." |
| 11 | 1:42–1:54 | **How it works**: scroll through **Twelve agents, one job each**, the animated flowchart, **How we test it**, and the live trace with the G1–G4 verdicts from this session. | "Specialised agents, eight guardrails, and a trace of every decision. Offline, the guardrails pass all 23 adversarial tests. Against the live models, the module agent quoted exact assessment weightings in 12 of 12 questions." |
| 12 | 1:54–2:00 | End card: "ModuleMatch · modulematch.vercel.app · github.com/arnavpopley/imperial-ai-hack". | "Numbers from code, words from models, and people in the loop. That's ModuleMatch." |

## Notes for the shots

- **Shot 3.** If the interviewer skips the career question (it may, if the first answer already named a goal), drop that answer. The Career slider in shot 6 only works once a pathway is in the profile.
- **Shot 7.** The clash comes from the synthetic timetable: MECH60018 lectures and MECH60009's lab both start on Tuesday at 14:00 in spring. If the swap list differs from the one you rehearsed, pick the top swap.
- **Shot 8.** In offline mode the reply is the template captured in `docs/EXAMPLES.md` (example 2). With live models the wording changes, but the refusal and the draft do not, because they come from the rules engine.
- **Shot 10.** Most modules have no single big lever. In the synthetic cohort only two modules have a change worth two or more fit points: BUSI60043 (+2.1) and MECH70014 (+2.8). The other 42 modules with at least five interested students get one summary card that names their main gap instead. Show BUSI60043, because its card has an outcome a module lead can act on: 9 of the 19 interested students would reach fit 70. MECH70014's card has the bigger average, but nobody would reach fit 70 or move it into their top five. That is why the shot is honest: it shows the strongest real suggestion in the cohort, with its impact in students rather than points, and the voice-over says that most modules have no such lever. Don't promise a big number. The card sits first on the dashboard, above the clash with IEX-DECISIONS (21 students, certain). After **Accept**, "Make this change in the tag editor" opens the tag editor with the new topic already in the draft, unsaved; you don't need to show that in this shot.
- **Shot 11.** The "How it works" page shows the offline evaluation and, under it, "With the live models": the committed live run (`data/eval-live-latest.json`) with its date, the Fable 5.1 judge and each miss.

## Backup plan if the live API is slow

The app runs end to end with no network calls to the model API. Every agent has a deterministic offline path, and the decisions (scores, rules, clashes, escalations) are the same.

1. **Switch to offline mode.** Stop the dev server and run:

   ```sh
   MODULEMATCH_OFFLINE=1 npm run dev
   ```

   Open http://localhost:5173 and repeat the shot list. Offline, the interviewer uses the fixed question plan, and explanations, catalogue answers and module answers use templates. Answer the interview in the order of shot 3. The offline questions are always: topics you love, what to avoid, career, assessment, the maths and coding sliders, team and workload, breadth, timetable.
2. **In offline mode, don't open reasons that quote the slider answer.** The keyword extractor reads "Maths comfort: 70%." as an interest in maths, so a template reason can cite it as something the student enjoys. Open a module whose reasons quote the typed answers instead.
3. **If one live call stalls mid-demo,** wait. Each agent falls back to its template when a call fails or returns an incomplete reply, so the turn still completes.
4. **If the laptop or the network fails,** play the recorded video and narrate over it.
5. **Record the backup video before judging** (spec 18.2), in offline mode, so it cannot depend on the API at all.
