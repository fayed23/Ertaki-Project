# Quran surah/āyah dataset — Qalūn ‘an Nāfi‘

**Riwayah:** قالون عن نافع (Qalūn ‘an Nāfi‘)  
**Total āyahs:** 6214 (not Ḥafṣ 6236)

## Source
- Primary extract: [`quran-center/quran-meta`](https://github.com/quran-center/quran-meta) → `src/lists/QalunLists.ts` (`SurahList` āyah counts).
- Upstream font metadata cited by that project: **KFGQPC `QalounData_v2-1.json`** (King Fahd Complex Qalūn Uthmanic font).
- Counting system: Madinan (Nāfi‘) verse boundaries as used for Qalūn (total matches Warsh at 6214).

## Why not Ḥafṣ
Ḥafṣ ‘an ‘Āṣim uses Kufan verse counting (6236). Several surahs differ in āyah count/numbering (e.g. البقرة **285** in Qalūn vs **286** in Ḥafṣ; الأنعام **167** in Qalūn vs **165** in Ḥafṣ). Daily report from–to āyah pickers must use this file — never a Ḥafṣ-only table.

## Files
- `qalun_surahs.json` — Flutter `assets/quran/` and API `api/data/quran/`.
