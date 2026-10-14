Demo scope: first 5000 rows of yellow_tripdata_2019-01.csv.
Result: read 5000, normal 4952, flagged 34,excluded 14.
Reasons: bad_time 5, negative_value 9 in that smaple. Zero-distance rows are flagged, not removed.
Zones 265 lookup rows loaded ,260 have plygons, 5 without(57,104,105,264,265).
Cleaning v1 thresholds:flag distnace 0,distance over 10,fare over 500,duration over 1440 min, speed over 100mph.
Timezone:America/New_York, timestamps stored as local strings
Limits:Subset only covers early 2019-01-01 trips, not the full month. Full month needs a run with a high limit and more time.
Unexpected:negative fares exist (for example -52 in the sample) and some 0-distnace trips carry a normal fare, so they are kept as flagged instead of deleted
Reren rule:same file plus same scope returns the old import id and does not insert again. Failed imports stays status failed and are never used by the api