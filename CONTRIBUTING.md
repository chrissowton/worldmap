# Contributing

Thanks for helping. The most useful contributions are:

1. **New characteristics.** Follow "Adding a new characteristic" in the README. Please include the source URL, the year the data describes and its licence. Only add data under licences that allow redistribution and commercial use (CC0, CC BY, CC BY-SA, ODbL, MIT, public domain).
2. **Data corrections.** If a value is wrong, fix it at the source step in `build_data.py` (like `DRIVE_FIX`) with a comment saying where the correct value comes from, rather than editing `countries.json` by hand.
3. **Starter questions and puzzles** in `filters.js`. Good puzzles have between one and eight answers and a surprising result.
4. **Accessibility and design fixes.**

Please keep the site dependency-light: plain JavaScript, D3, no build step.

When a measure is contested (democracy, religion, language), name the definition in the filter's `info` text so people can see whose definition they're using.
