# csv-reader-speed-01

A faster, dependency-free drop-in for make.fun's csv-reader 1.0.0, written for the csv-reader-speed-01 bounty (`node main.ts` + `solve.js`).

Lines with no quote and no stray CR are cut with one `indexOf` + `slice` + `split`; everything else goes through a field-by-field slow path that uses cached `indexOf` jumps and reproduces csv-reader's broken-row policy exactly (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`, `long_row`, line counting inside quotes). Output is identical to the reference on the practice set and on a differential fuzz test.

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/emasinves0-commits/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/emasinves0-commits/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
