/* ================================================================
   DATA LAYER
   Direct, line-by-line translation of the C++ assignment
   (Candidate, Stage, RecruitmentPipeline). The C++ version used a
   hand-written DynamicArray because vector/list/map were not
   allowed -- in JavaScript a plain array already behaves like that
   DynamicArray, so it is used directly instead of reimplementing
   it. Everything else (the singly linked list of Stage nodes, the
   loops, the checks, the order of the checks) mirrors the C++ code
   exactly. No array.find/.some/.filter/.reduce/.forEach tricks --
   just plain indexed loops, the same way the C++ does it.

   The only real difference from the C++ program: instead of
   printing straight to cout, each method RETURNS a small result
   object { ok, msg } (and sometimes extra fields) so the website
   can show that same message as a toast / log line.
   ================================================================ */


// ----------------------------------------------------------------
// CANDIDATE
// ----------------------------------------------------------------

class Candidate {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.university = data.university;
    this.cgpa = data.cgpa;
    this.experience = data.experience;
    this.technicalScore = data.technicalScore !== undefined ? data.technicalScore : 0;
    this.interviewScore = data.interviewScore !== undefined ? data.interviewScore : 0;

    this.skills = [];
    if (data.skills) {
      for (let i = 0; i < data.skills.length; i++) {
        this.skills[i] = data.skills[i];
      }
    }

    this.status = data.status ? data.status : "ACTIVE";
  }

  // Time: O(k), k = number of skills -- same as the C++ hasSkill()
  hasSkill(skill) {
    for (let i = 0; i < this.skills.length; i++) {
      if (this.skills[i].toLowerCase() === skill.toLowerCase()) {
        return true;
      }
    }
    return false;
  }
}


// ----------------------------------------------------------------
// STAGE  (singly linked list node)
// ----------------------------------------------------------------

class Stage {
  constructor(name) {
    this.name = name;
    this.candidates = []; // plays the role of the C++ DynamicArray<Candidate>
    this.next = null;
  }
}


// ----------------------------------------------------------------
// RECRUITMENT PIPELINE
// ----------------------------------------------------------------

class RecruitmentPipeline {
  constructor() {
    this.head = null;
    this.withdrawnIds = []; // only IDs are remembered, same as the C++ withdrawnIDs array
  }

  // --------------------------------------------------------
  // Normalize HR naming -- same as C++ sameStageName()
  // --------------------------------------------------------
  sameStageName(a, b) {
    if (a === b) return true;
    if (a === "HR" && b === "HR Interview") return true;
    if (a === "HR Interview" && b === "HR") return true;
    return false;
  }

  // --------------------------------------------------------
  // Find Stage -- Time: O(S)
  // --------------------------------------------------------
  findStage(name) {
    let current = this.head;
    while (current !== null) {
      if (this.sameStageName(current.name, name)) {
        return current;
      }
      current = current.next;
    }
    return null;
  }

  // --------------------------------------------------------
  // Collect every stage into a plain array, in order.
  // (Used only so the website can render the whole board -- the
  // C++ program never needed this, since it just walked the
  // linked list directly while printing.)
  // --------------------------------------------------------
  allStages() {
    const stages = [];
    let current = this.head;
    while (current !== null) {
      stages.push(current);
      current = current.next;
    }
    return stages;
  }

  // --------------------------------------------------------
  // Candidate existence -- Time: O(total candidates + stages)
  // --------------------------------------------------------
  candidateExists(id) {
    let current = this.head;
    while (current !== null) {
      for (let i = 0; i < current.candidates.length; i++) {
        if (current.candidates[i].id === id) {
          return true;
        }
      }
      current = current.next;
    }
    return false;
  }

  // --------------------------------------------------------
  // Withdrawn check -- Time: O(W)
  // --------------------------------------------------------
  wasWithdrawn(id) {
    for (let i = 0; i < this.withdrawnIds.length; i++) {
      if (this.withdrawnIds[i] === id) {
        return true;
      }
    }
    return false;
  }

  // --------------------------------------------------------
  // Eligibility function -- same rules as the C++ version
  // --------------------------------------------------------
  eligibleForPromotion(candidate, currentStageName) {
    if (currentStageName === "Applied") {
      return candidate.cgpa >= 3.0;
    }

    if (currentStageName === "Screening") {
      // CGPA >= 3.2 AND at least 2 skills recorded
      return candidate.cgpa >= 3.2 && candidate.skills.length >= 2;
    }

    if (currentStageName === "Technical Interview") {
      return candidate.technicalScore >= 70;
    }

    if (currentStageName === "HR Interview" || currentStageName === "HR") {
      return candidate.technicalScore >= 80 && candidate.interviewScore >= 75;
    }

    // Custom inserted stages have no automatic promotion rule.
    return false;
  }

  // ========================================================
  // ADD STAGE AT END -- Time: O(S)
  // ========================================================
  addStage(name) {
    if (this.findStage(name) !== null) {
      return { ok: false, msg: "Stage already exists." };
    }

    const newStage = new Stage(name);

    if (this.head === null) {
      this.head = newStage;
      return { ok: true, msg: `Stage "${name}" added.` };
    }

    let current = this.head;
    while (current.next !== null) {
      current = current.next;
    }
    current.next = newStage;

    return { ok: true, msg: `Stage "${name}" added.` };
  }

  // ========================================================
  // INITIAL PIPELINE
  // ========================================================
  createInitialPipeline() {
    this.addStage("Applied");
    this.addStage("Screening");
    this.addStage("Technical Interview");
    this.addStage("HR Interview");
    this.addStage("Selected");
  }

  // ========================================================
  // ADD CANDIDATE -- Time: O(total candidates + S)
  // ========================================================
  addCandidate(stageName, data) {
    if (this.candidateExists(data.id) || this.wasWithdrawn(data.id)) {
      return { ok: false, msg: `Duplicate candidate ID: ${data.id}` };
    }

    const stage = this.findStage(stageName);
    if (stage === null) {
      return { ok: false, msg: "Stage not found." };
    }

    stage.candidates.push(new Candidate(data));
    return { ok: true, msg: `Candidate ${data.id} added to ${stage.name}.` };
  }

  // ========================================================
  // MOVE CANDIDATE -- Time: O(S + C)
  // ========================================================
  moveCandidate(id, destinationStageName) {
    const destination = this.findStage(destinationStageName);
    if (destination === null) {
      return { ok: false, msg: "Destination stage not found." };
    }

    let current = this.head;
    while (current !== null) {
      for (let i = 0; i < current.candidates.length; i++) {
        if (current.candidates[i].id === id) {
          if (current === destination) {
            return { ok: false, msg: `Candidate is already in ${destination.name}.` };
          }

          // Add first, then remove -- mirrors the original C++ comment:
          // this guarantees the candidate's data is preserved before
          // the source array shifts.
          const candidate = current.candidates[i];
          destination.candidates.push(candidate);
          current.candidates.splice(i, 1);

          return { ok: true, msg: `Candidate ${id} moved from ${current.name} to ${destination.name}.` };
        }
      }
      current = current.next;
    }

    if (this.wasWithdrawn(id)) {
      return { ok: false, msg: "Candidate has already withdrawn." };
    }
    return { ok: false, msg: "Candidate not found." };
  }

  // ========================================================
  // PIPELINE INTEGRITY CHECK -- Time: O(C^2)
  // ========================================================
  checkPipelineIntegrity() {
    const stages = this.allStages();

    for (let i = 0; i < stages.length; i++) {
      const stage1 = stages[i];

      for (let a = 0; a < stage1.candidates.length; a++) {
        const id = stage1.candidates[a].id;

        // duplicate inside the same stage
        for (let b = a + 1; b < stage1.candidates.length; b++) {
          if (stage1.candidates[b].id === id) {
            return { ok: false, msg: `Pipeline corrupted -- duplicate candidate ID ${id} found twice in ${stage1.name}.` };
          }
        }

        // duplicate in a later stage
        for (let j = i + 1; j < stages.length; j++) {
          const stage2 = stages[j];
          for (let b = 0; b < stage2.candidates.length; b++) {
            if (stage2.candidates[b].id === id) {
              return { ok: false, msg: `Pipeline corrupted -- duplicate candidate ID ${id} found in both ${stage1.name} and ${stage2.name}.` };
            }
          }
        }
      }
    }

    return { ok: true, msg: "Pipeline integrity OK -- no duplicate candidates found." };
  }

  // ========================================================
  // WITHDRAW CANDIDATE -- Time: O(S + C + W)
  // ========================================================
  withdrawCandidate(id) {
    if (this.wasWithdrawn(id)) {
      return { ok: false, msg: "Candidate has already withdrawn." };
    }

    let current = this.head;
    while (current !== null) {
      for (let i = 0; i < current.candidates.length; i++) {
        if (current.candidates[i].id === id) {
          current.candidates[i].status = "WITHDRAWN";
          current.candidates.splice(i, 1);
          this.withdrawnIds.push(id);
          return { ok: true, msg: `Candidate ${id} withdrawn successfully.` };
        }
      }
      current = current.next;
    }

    return { ok: false, msg: "Candidate not found." };
  }

  // ========================================================
  // UPDATE TECHNICAL SCORE -- Time: O(S + C)
  // ========================================================
  updateTechnicalScore(id, newScore) {
    if (newScore < 0 || newScore > 100) {
      return { ok: false, msg: "Invalid score." };
    }

    let current = this.head;
    while (current !== null) {
      for (let i = 0; i < current.candidates.length; i++) {
        if (current.candidates[i].id === id) {
          if (current.name !== "Technical Interview") {
            return { ok: false, msg: "Technical score can only be updated during the Technical Interview stage." };
          }
          current.candidates[i].technicalScore = newScore;
          return { ok: true, msg: "Technical score updated successfully." };
        }
      }
      current = current.next;
    }

    if (this.wasWithdrawn(id)) {
      return { ok: false, msg: "Candidate has already withdrawn." };
    }
    return { ok: false, msg: "Candidate not found." };
  }

  // ========================================================
  // UPDATE INTERVIEW SCORE -- Time: O(S + C)
  // ========================================================
  updateInterviewScore(id, newScore) {
    if (newScore < 0 || newScore > 100) {
      return { ok: false, msg: "Invalid score." };
    }

    let current = this.head;
    while (current !== null) {
      for (let i = 0; i < current.candidates.length; i++) {
        if (current.candidates[i].id === id) {
          if (!(current.name === "HR Interview" || current.name === "HR")) {
            return { ok: false, msg: "Interview score can only be updated during the HR Interview stage." };
          }
          current.candidates[i].interviewScore = newScore;
          return { ok: true, msg: "Interview score updated successfully." };
        }
      }
      current = current.next;
    }

    if (this.wasWithdrawn(id)) {
      return { ok: false, msg: "Candidate has already withdrawn." };
    }
    return { ok: false, msg: "Candidate not found." };
  }

  // ========================================================
  // PROMOTE ELIGIBLE CANDIDATES -- Time: O(S + C)
  //
  // Same guarantee as the C++ version: a candidate can move only
  // ONE stage during a single call. This is done by first
  // recording how many candidates were originally in each stage,
  // then only ever processing that many from each stage -- anyone
  // pushed in from the previous stage during this same call is
  // left for the *next* call.
  // ========================================================
  promoteEligibleCandidates() {
    const stages = this.allStages();
    if (stages.length === 0) {
      return { ok: false, msg: "Pipeline is empty.", log: [] };
    }

    const originalCounts = [];
    for (let i = 0; i < stages.length; i++) {
      originalCounts[i] = stages[i].candidates.length;
    }

    const promotions = [];

    for (let i = 0; i < stages.length - 1; i++) {
      const current = stages[i];
      const next = stages[i + 1];

      let processedOriginalCandidates = 0;
      let candidateIndex = 0;

      while (processedOriginalCandidates < originalCounts[i] && candidateIndex < current.candidates.length) {
        const candidate = current.candidates[candidateIndex];
        processedOriginalCandidates++;

        if (this.eligibleForPromotion(candidate, current.name)) {
          next.candidates.push(candidate);
          current.candidates.splice(candidateIndex, 1);
          promotions.push(`Candidate ${candidate.id} promoted from ${current.name} to ${next.name}.`);
          // do NOT increment candidateIndex -- the array just shifted left
        } else {
          candidateIndex++;
        }
      }
    }

    if (promotions.length === 0) {
      return { ok: true, msg: "No candidates were eligible for promotion.", log: [] };
    }
    return { ok: true, msg: `${promotions.length} candidate(s) promoted.`, log: promotions };
  }

  // ========================================================
  // GET BEST CANDIDATE -- Time: O(S + C)
  //
  // Final Score = 0.40 * (CGPA * 25) + 0.35 * Technical + 0.25 * Interview
  // Ties broken by: higher technical score, then higher CGPA,
  // then lower candidate ID.
  // ========================================================
  getBestCandidate() {
    const stages = this.allStages();

    let best = null;
    let bestFinalScore = -1;

    for (let s = 0; s < stages.length; s++) {
      const stage = stages[s];

      for (let i = 0; i < stage.candidates.length; i++) {
        const candidate = stage.candidates[i];

        const cgpaScore = candidate.cgpa * 25.0;
        const finalScore = 0.40 * cgpaScore + 0.35 * candidate.technicalScore + 0.25 * candidate.interviewScore;

        let chooseCandidate = false;

        if (best === null) {
          chooseCandidate = true;
        } else if (finalScore > bestFinalScore) {
          chooseCandidate = true;
        } else if (finalScore === bestFinalScore) {
          if (candidate.technicalScore > best.technicalScore) {
            chooseCandidate = true;
          } else if (candidate.technicalScore === best.technicalScore) {
            if (candidate.cgpa > best.cgpa) {
              chooseCandidate = true;
            } else if (candidate.cgpa === best.cgpa && candidate.id < best.id) {
              chooseCandidate = true;
            }
          }
        }

        if (chooseCandidate) {
          best = candidate;
          bestFinalScore = finalScore;
        }
      }
    }

    if (best === null) {
      return null;
    }
    return { candidate: best, score: bestFinalScore };
  }

  // ========================================================
  // FIND CANDIDATES BY SKILL -- Time: O(C * K)
  // ========================================================
  findCandidatesBySkill(skill) {
    const results = [];
    const stages = this.allStages();

    for (let s = 0; s < stages.length; s++) {
      const stage = stages[s];
      for (let i = 0; i < stage.candidates.length; i++) {
        if (stage.candidates[i].hasSkill(skill)) {
          results.push({ stage: stage.name, candidate: stage.candidates[i] });
        }
      }
    }

    return results;
  }

  // ========================================================
  // MOST CROWDED STAGE -- Time: O(S)
  // If tied, the earliest stage wins (comparison uses > not >=).
  // ========================================================
  getMostCrowdedStage() {
    if (this.head === null) {
      return null;
    }

    let crowded = this.head;
    let current = this.head.next;

    while (current !== null) {
      if (current.candidates.length > crowded.candidates.length) {
        crowded = current;
      }
      current = current.next;
    }

    return crowded;
  }

  // ========================================================
  // REMOVE STAGE -- Time: O(S)
  // ========================================================
  removeStage(name) {
    if (this.head === null) {
      return { ok: false, msg: "Pipeline is empty." };
    }

    if (this.sameStageName(this.head.name, name)) {
      if (this.head.candidates.length > 0) {
        return { ok: false, msg: "Stage cannot be removed because it contains candidates." };
      }
      this.head = this.head.next;
      return { ok: true, msg: "Stage removed successfully." };
    }

    let current = this.head;
    while (current.next !== null && !this.sameStageName(current.next.name, name)) {
      current = current.next;
    }

    if (current.next === null) {
      return { ok: false, msg: "Stage not found." };
    }

    const target = current.next;
    if (target.candidates.length > 0) {
      return { ok: false, msg: "Stage cannot be removed because it contains candidates." };
    }

    current.next = target.next;
    return { ok: true, msg: "Stage removed successfully." };
  }

  // ========================================================
  // INSERT STAGE -- Time: O(S)
  // ========================================================
  insertStage(newStageName, afterStageName) {
    if (this.findStage(newStageName) !== null) {
      return { ok: false, msg: "Stage already exists." };
    }

    const afterStage = this.findStage(afterStageName);
    if (afterStage === null) {
      return { ok: false, msg: `Stage "${afterStageName}" not found.` };
    }

    const newStage = new Stage(newStageName);
    newStage.next = afterStage.next;
    afterStage.next = newStage;

    return { ok: true, msg: `"${newStageName}" inserted after "${afterStage.name}".` };
  }

  // ========================================================
  // REVERSE PIPELINE -- Time: O(S)
  // Only the `next` pointers change; candidate arrays are untouched.
  // ========================================================
  reversePipeline() {
    let previous = null;
    let current = this.head;

    while (current !== null) {
      const nextNode = current.next;
      current.next = previous;
      previous = current;
      current = nextNode;
    }

    this.head = previous;
    return { ok: true, msg: "Pipeline reversed successfully." };
  }

  // ========================================================
  // CYCLE DETECTION -- Floyd's Tortoise and Hare, Time: O(S)
  // ========================================================
  hasCycle() {
    let slow = this.head;
    let fast = this.head;

    while (fast !== null && fast.next !== null) {
      slow = slow.next;
      fast = fast.next.next;
      if (slow === fast) {
        return true;
      }
    }

    return false;
  }

  // ========================================================
  // DISPLAY STATISTICS -- Time: O(S + C)
  // ========================================================
  displayStatistics() {
    const stages = this.allStages();
    let totalCandidates = 0;
    const rows = [];

    for (let s = 0; s < stages.length; s++) {
      const stage = stages[s];
      const numberOfCandidates = stage.candidates.length;
      totalCandidates += numberOfCandidates;

      if (numberOfCandidates === 0) {
        rows.push({ name: stage.name, count: 0 });
        continue;
      }

      let totalCgpa = 0;
      let totalTechnical = 0;
      let totalInterview = 0;

      for (let i = 0; i < numberOfCandidates; i++) {
        totalCgpa += stage.candidates[i].cgpa;
        totalTechnical += stage.candidates[i].technicalScore;
        totalInterview += stage.candidates[i].interviewScore;
      }

      rows.push({
        name: stage.name,
        count: numberOfCandidates,
        avgCgpa: totalCgpa / numberOfCandidates,
        avgTech: totalTechnical / numberOfCandidates,
        avgIntv: totalInterview / numberOfCandidates,
      });
    }

    return { rows: rows, total: totalCandidates };
  }

  /* ----------------------------------------------------------
     Persistence -- not part of the original C++ program (a
     console program has nothing to save between runs), but the
     website needs it to remember the pipeline in localStorage.
     ---------------------------------------------------------- */

  serialize() {
    const stages = this.allStages();
    const stagesOut = [];
    for (let i = 0; i < stages.length; i++) {
      stagesOut.push({ name: stages[i].name, candidates: stages[i].candidates });
    }
    return JSON.stringify({ stages: stagesOut, withdrawnIds: this.withdrawnIds });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const pipeline = new RecruitmentPipeline();

    for (let i = 0; i < data.stages.length; i++) {
      const s = data.stages[i];
      pipeline.addStage(s.name);
      const stage = pipeline.findStage(s.name);

      const candidates = [];
      for (let c = 0; c < s.candidates.length; c++) {
        candidates.push(new Candidate(s.candidates[c]));
      }
      stage.candidates = candidates;
    }

    pipeline.withdrawnIds = data.withdrawnIds ? data.withdrawnIds : [];
    return pipeline;
  }
}


// ----------------------------------------------------------------
// SEED DATA -- same sample candidates as the C++ main(), used to
// pre-populate the website on first load.
// ----------------------------------------------------------------
function seedPipeline() {
  const pipeline = new RecruitmentPipeline();
  pipeline.createInitialPipeline();

  pipeline.addCandidate("Applied", { id: 101, name: "Ali Ahmed", university: "FAST", cgpa: 3.72, experience: 1, technicalScore: 0, interviewScore: 0, skills: ["C++", "Python", "Machine Learning"] });
  pipeline.addCandidate("Applied", { id: 102, name: "Sara Khan", university: "NUST", cgpa: 3.55, experience: 2, technicalScore: 0, interviewScore: 0, skills: ["Python", "AI"] });
  pipeline.addCandidate("Applied", { id: 103, name: "Ahmed Raza", university: "COMSATS", cgpa: 3.40, experience: 1, technicalScore: 0, interviewScore: 0, skills: ["C++", "Data Structures"] });
  pipeline.addCandidate("Screening", { id: 106, name: "Hassan Ali", university: "FAST", cgpa: 3.25, experience: 2, technicalScore: 0, interviewScore: 0, skills: ["C++", "Python"] });
  pipeline.addCandidate("Technical Interview", { id: 108, name: "Usman Tariq", university: "NUST", cgpa: 3.61, experience: 2, technicalScore: 75, interviewScore: 0, skills: ["C++", "Machine Learning"] });
  pipeline.addCandidate("HR Interview", { id: 110, name: "Ayesha Noor", university: "GIKI", cgpa: 3.80, experience: 1, technicalScore: 84, interviewScore: 80, skills: ["Python", "AI", "C++"] });

  return pipeline;
}
