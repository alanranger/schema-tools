# Bulk regeneration log — blog HowTo / FAQ

Append-only log for `npm run bulk:blog-howto-faq` (or `node scripts/bulk-regen-blog-howto-faq.mjs`).

Each line is ISO timestamp plus message. Processing uses batches (default 50 URLs); each batch ends with a git commit and push in `alanranger-schema` unless `--no-commit` is set. Runs halt if any batch exceeds a 10% error rate. With `--from-schema-dir`, only schemas whose canonical WebPage URL is under `/blog-on-photography/` are included; filenames containing `_event` are skipped.

---
2026-05-12T21:03:23.085Z Starting bulk HowTo/FAQ regen: 464 URL(s), batch=50, repo=G:\Dropbox\alan ranger photography\Website Code\Schema Tools\alanranger-schema, noCommit=false
2026-05-12T21:03:23.832Z 10-basic-camera-settings-for-camera howto=E/10 faq=A/15 files=ok-howto,ok-faq
2026-05-12T21:03:24.094Z 10-composition-pdfs-photography-field-checklists-bundle ERROR HTTP 404
2026-05-12T21:03:24.520Z 15-camera-settings-photography-field-checklists-pdf-bundle ERROR HTTP 404
2026-05-12T21:03:25.145Z 15-principles-to-improve-composition howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:25.491Z 35-pdfs-1-page-photography-field-checklists-bundle ERROR HTTP 404
2026-05-12T21:03:25.837Z 4-x-2hr-private-photography-classes-face-to-face-coventry ERROR HTTP 404
2026-05-12T21:03:26.567Z 5-reasons-to-use-a-tripod howto=E/5 faq=none/0 files=ok-howto,skip-faq
2026-05-12T21:03:27.087Z 5-stages-to-improve-your-photography howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:27.263Z 7-essential-camera-accessories howto=E/7 faq=A/4 files=ok-howto,ok-faq
2026-05-12T21:03:27.800Z 7-most-common-camera-exposure-mistakes howto=E/6 faq=none/0 files=ok-howto,skip-faq
2026-05-12T21:03:28.298Z a-christmas-day-memory-crisis howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:28.555Z abstract-and-macro-photography-workshop-coventry_event ERROR HTTP 404
2026-05-12T21:03:28.750Z abstract-photography-1 howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:29.224Z abstract-photography-practice-assignment-free-lesson howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:29.734Z advanced-editing-with-nik-collection howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:30.042Z airbnb-photography-guide howto=A/6 faq=A/8 files=ok-howto,ok-faq
2026-05-12T21:03:30.332Z alan-ranger-academy-photography-foundation-course-ebook ERROR HTTP 404
2026-05-12T21:03:30.963Z alistair-willis-rps-distinctions howto=E/8 faq=C-headings/6 files=ok-howto,ok-faq
2026-05-12T21:03:31.506Z alternative-long-exposure-photography-techniques howto=B/10 faq=none/0 files=ok-howto,skip-faq
2026-05-12T21:03:31.783Z anglesey-landscape-photography-workshop-may-2027 ERROR HTTP 404
2026-05-12T21:03:32.152Z anglesey-photography-workshop-wales_event ERROR HTTP 404
2026-05-12T21:03:32.439Z annual-pick-n-mix-subscription-interest-free-payment-plan ERROR HTTP 404
2026-05-12T21:03:32.713Z aperture-and-depth-of-field-assignment howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:33.209Z aperture-field-checklist howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:33.503Z architecture-photography-guide howto=none/0 faq=A/7 files=skip-howto,ok-faq
2026-05-12T21:03:33.639Z architecture-photography-guide-checklist howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:34.112Z architecture-photography-practice-assignment howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:34.163Z are-camera-uv-filters-worth-it howto=none/0 faq=A/5 files=skip-howto,ok-faq
2026-05-12T21:03:34.503Z are-mirrorless-cameras-better-than-dslrs howto=none/0 faq=A/4 files=skip-howto,ok-faq
2026-05-12T21:03:34.864Z art-of-macro-photography howto=none/0 faq=A/7 files=skip-howto,ok-faq
2026-05-12T21:03:35.337Z autumn-arboretum-photography-uk-guide howto=A/6 faq=A/8 files=ok-howto,ok-faq
2026-05-12T21:03:35.543Z autumn-photography-tips howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:36.921Z avoid-camera-shake howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:37.293Z basics-how-to-use-a-tripod howto=B/5 faq=none/0 files=ok-howto,skip-faq
2026-05-12T21:03:37.567Z batsford-arboretum-autumn-photography-1nov_event ERROR HTTP 404
2026-05-12T21:03:37.911Z batsford-arboretum-autumn-photography-29oct_event ERROR HTTP 404
2026-05-12T21:03:38.334Z batsford-arboretum-autumn-photography-2nov_event ERROR HTTP 404
2026-05-12T21:03:38.672Z batsford-arboretum-autumn-photography-30oct_event ERROR HTTP 404
2026-05-12T21:03:39.001Z batsford-arboretum-autumn-photography-31oct_event ERROR HTTP 404
2026-05-12T21:03:39.505Z batsford-arboretum-autumn-photography-3nov_event ERROR HTTP 404
2026-05-12T21:03:39.853Z batsford-arboretum-autumn-photography-workshops-23-31-oct ERROR HTTP 404
2026-05-12T21:03:40.435Z become-a-better-photographer howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:40.987Z become-a-photographer-on-campus howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:41.299Z beginners-photography-course-3-weekly-evening-classes ERROR HTTP 404
2026-05-12T21:03:41.838Z beginners-photography-course-in-coventry howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:42.092Z beginners-portrait-photography-course-coventry-1-day ERROR HTTP 404
2026-05-12T21:03:42.425Z best-camera-bags-for-different-trips howto=E/10 faq=A/4 files=ok-howto,ok-faq
2026-05-12T21:03:42.715Z best-cameras-for-beginners howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:03:43.269Z best-product-photography-tripod howto=none/0 faq=A/4 files=skip-howto,ok-faq
2026-05-12T21:03:43.832Z best-tripod-for-landscape-photography howto=E/5 faq=A/5 files=ok-howto,ok-faq
2026-05-12T21:03:43.833Z Halted: batch error rate 36.0% exceeds 10% (18/50).
2026-05-12T21:05:38.238Z Starting bulk HowTo/FAQ regen: 8 URL(s), batch=50, repo=G:\Dropbox\alan ranger photography\Website Code\Schema Tools\alanranger-schema, noCommit=true
2026-05-12T21:05:38.633Z 10-basic-camera-settings-for-camera howto=E/10 faq=A/15 files=ok-howto,ok-faq
2026-05-12T21:05:38.775Z 15-principles-to-improve-composition howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:05:38.912Z 5-reasons-to-use-a-tripod howto=E/5 faq=none/0 files=ok-howto,skip-faq
2026-05-12T21:05:39.041Z 5-stages-to-improve-your-photography howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:05:39.091Z 7-essential-camera-accessories howto=E/7 faq=A/4 files=ok-howto,ok-faq
2026-05-12T21:05:39.230Z 7-most-common-camera-exposure-mistakes howto=E/6 faq=none/0 files=ok-howto,skip-faq
2026-05-12T21:05:39.370Z a-christmas-day-memory-crisis howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:05:39.428Z abstract-photography-1 howto=none/0 faq=none/0 files=skip-howto,skip-faq
2026-05-12T21:05:39.429Z Finished bulk HowTo/FAQ regen (8 URL(s)).
