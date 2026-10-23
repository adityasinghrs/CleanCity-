# Literature Survey – CleanCity

> **How to use this:** every paper marked ✅ was looked up online while preparing this document (title, authors/venue and the gist were confirmed). Papers marked 📚 are classic references I am citing from memory; **open each one on Google Scholar and confirm the details before putting it in your report.** Rewrite the summaries in your own words and format them in your college's citation style (IEEE/APA).

## 1. Problem background
Cities receive far more garbage complaints than they can inspect. Existing work falls into three groups: (a) sensor/IoT systems for bins and trucks, (b) computer-vision systems that recognise litter, and (c) citizen-reporting platforms. CleanCity belongs to group (c) and borrows ideas from (a) and (b).

## 2. Papers reviewed

| # | Reference | Group | What it contributes | Limitation (our gap) |
|---|---|---|---|---|
| 1 ✅ | A. Medvedev, P. Fedchenkov, A. Zaslavsky, T. Anagnostopoulos, S. Khoruzhnikov, "Waste Management as an IoT-Enabled Service in Smart Cities", NEW2AN / ruSMART 2015, Springer. DOI 10.1007/978-3-319-23126-6_10 | IoT | Proposes a decision-support system where RFID, sensors and cameras help trucks collect waste with dynamic route changes, including areas that are hard to reach. | Needs hardware on every bin; no way for ordinary citizens to report what sensors miss. |
| 2 ✅ | T. Anagnostopoulos, A. Zaslavsky, A. Medvedev, S. Khoruzhnikov, "Top-k Query Based Dynamic Scheduling for IoT-enabled Smart City Waste Collection", 2015 | IoT | Uses top-k queries over sensor data to prioritise which waste to pick up first and to size the truck fleet. | Priority comes only from fill-level sensors. CleanCity gets a similar *prioritised* queue from category + upvotes + age without any hardware. |
| 3 ✅ | P. F. Proença, P. Simões, "TACO: Trash Annotations in Context for Litter Detection", arXiv:2003.06975, 2020 | Computer vision | Releases an open, crowd-grown dataset of litter photos in real outdoor scenes and tests Mask R-CNN on it; the authors say detection in the wild still needs many more annotations. | Detection accuracy is not yet deployment-grade, so CleanCity keeps a human admin in the loop and stores photos that could later be used for training. |
| 4 ✅ | "From complaints to insights: A geographical analysis of illegal dumping by citizen sensor data", *Cities*, vol. 161, art. 105892, 2025 | Citizen reporting + GIS | Analyses tens of thousands of illegal-dumping reports from Brussels' FixMyStreet and finds a "disorder effect": dumping tends to recur in places already affected. | Analysis is done offline by researchers after the fact; no live tool tells the city *which spots keep relapsing*. **This is the gap CleanCity's Hotspot Intelligence fills.** |
| 5 ✅ | B. Yang, W. Lu, J. Chen, L. Yuan, Z. Bao, "Dynamics of street views and socio-economic conditions in profiling illegal dumping 'black spots': An LLM-enabled study in Hong Kong" (article 115137) | GIS + ML | Combines street-view imagery with spatial machine learning to profile dumping black spots; clustered hotspots with visible waste raise risk. | Heavy data and model requirements; not a day-to-day operations tool. CleanCity uses lightweight clustering on the city's own complaint data. |
| 6 📚 | M. Ester, H.-P. Kriegel, J. Sander, X. Xu, "A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise", KDD 1996, pp. 226-231 | Algorithm | Introduces DBSCAN: groups points that are densely packed, marks isolated points as noise, needs no preset number of clusters. | General algorithm; we apply it to complaint coordinates with a 100 m radius. |
| 7 📚 | C. Zauner, "Implementation and Benchmarking of Perceptual Image Hash Functions", Master's thesis, Upper Austria Univ. of Applied Sciences, 2010 | Image forensics | Compares perceptual hashes that stay similar when an image is resized or compressed, so near-duplicates can be found by Hamming distance. | Used for copy detection in general; we apply it to detect duplicate reports and fake "after" photos. |
| 8 📚 | S. Deterding, D. Dixon, R. Khaled, L. Nacke, "From Game Design Elements to Gamefulness: Defining Gamification", MindTrek 2011 | HCI | Defines gamification as using game elements in non-game settings. | Basis for Eco-Points and the leaderboard that keep citizens engaged. |
| 10 ✅ | H. Han, E. Ponce Cueto, "Waste Collection Vehicle Routing Problem: Literature Review", *Promet - Traffic&Transportation*, vol. 27, no. 4, pp. 345-358, 2015. DOI 10.7307/ptt.v27i4.1616 | Routing | Review of waste-collection vehicle routing (node and arc routing, residential / commercial / industrial waste) and the methods used to solve it. | Assumes a fixed set of collection points. Citizen complaints arrive randomly and carry urgency, so a different, priority-driven planning step is needed. |
| 11 ✅ | J. Beliën, L. De Boeck, J. Van Ackere, "Municipal Solid Waste Collection and Management Problems: A Literature Review", *Transportation Science*, 2014. DOI 10.1287/trsc.1120.0448 *(title and DOI confirmed online; confirm author list on the publisher page)* | Routing | Classifies the waste-management literature, with a focus on vehicle routing, and points out unexplored research areas. | Routing models optimise collection of known bins, not ad-hoc citizen-reported problems with deadlines. |
| 12 ✅ | A. Blum, P. Chalasani, D. Coppersmith, B. Pulleyblank, P. Raghavan, M. Sudan, "The minimum latency problem", STOC 1994, pp. 163-171 | Algorithm | Defines the *latency* of a stop as the distance travelled before first visiting it, and minimises the total (the "deliveryman / travelling repairman" problem). Gives a constant-factor approximation when distances obey the triangle inequality. | Weights all stops equally. We add an **urgency weight per stop** (priority, SLA breach, hotspot), which is what lets the crew reach critical complaints first. |
| 13 ✅ | G. A. Croes, "A Method for Solving Traveling-Salesman Problems", *Operations Research*, vol. 6, no. 6, pp. 791-812, 1958. DOI 10.1287/opre.6.6.791 | Algorithm | Early edge-exchange improvement method for tours (the idea behind **2-opt**). | Used for closed tours. We apply the same segment-reversal idea to an open route with a weighted-latency cost. |
| 9 📚 | G. Thung, M. Yang, "Classification of Trash for Recyclability Status", Stanford CS229 project, 2016 (TrashNet) | Computer vision | Early public trash-image dataset with six material classes. | Photos on plain backgrounds, unlike real street scenes (the point made by TACO). Listed as *future work*: auto-suggest category from the photo. |

## 3. Comparison with existing systems

| Capability | Typical complaint apps | IoT smart-bin systems | **CleanCity v6** |
|---|---|---|---|
| Needs special hardware | No | Yes | No |
| Photo + GPS report | Yes | No | Yes |
| Public tracking ID | Sometimes | No | Yes |
| Priority ranking | Rare | Fill level only | Category + upvotes + age |
| Duplicate detection | Rare | n/a | GPS (150 m) **+ photo fingerprint** |
| Proof-of-cleanup check | Rare | n/a | Before/after photos **+ similarity check** |
| Deadline per issue (SLA) | Rare | n/a | Yes, with overdue flag |
| Daily crew route from live complaints | No | Yes (needs bin sensors) | **Yes (urgency-weighted route planner)** |
| Public performance transparency | Rare | No | Yes (SLA compliance page) |
| **Finds repeat-offence hotspots** | **No** | Partly (bin data) | **Yes (DBSCAN + recurrence)** |

## 4. Research gap and contribution
Reviewed systems either need sensors on every bin, or analyse citizen complaints only offline. **CleanCity adds an online, hardware-free decision-support layer on top of citizen reports:** it clusters reports into hotspots, measures how often a cleaned place relapses, and recommends a different remedy depending on the dominant problem (enforcement, bin capacity, route gap, hazard response).

## 4b. Why the Crew Route Planner is new (v6)
Routing papers (Han & Ponce Cueto, 2015; Beliën et al., 2014) optimise collection of *known* bins. IoT scheduling (Anagnostopoulos et al., 2015) needs fill-level sensors. Citizen-reporting apps stop at "complaint received". CleanCity v6 connects the two: it turns *unstructured citizen complaints* into a *daily urgency-weighted crew route* by (1) scoring each complaint (priority + SLA breach + hotspot membership), (2) selecting the top-N, and (3) ordering them by minimising the urgency-weighted latency of Blum et al. (1994) with a greedy start and 2-opt improvement (Croes, 1958).

## 5. Future work (mention in viva)
Auto-suggest the category from the photo (TACO / TrashNet style model), email/SMS notifications, forecasting complaint volume per ward, staff/worker accounts with route assignment, road-network distances (OSRM) instead of straight-line distance, multi-crew routes with capacity.
