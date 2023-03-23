const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// function definitions at end

// temporary data
const subjectNumber = 1;
const lessonNumber = 2;
const email = "your email here";
const password = "your pass here";

async function mainScrape() {
  // launch window
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // set download location
  const client = await page.target().createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: path.resolve(__dirname, "slides"),
  });

  await loginPESU(page, email, password);

  await clickMyCourses(page);

  const grabbedSubjects = await getSubjects(page);
  console.log(grabbedSubjects);

  await clickSubject(page, subjectNumber);

  await clickLesson(page, lessonNumber);

  const grabbedTopics = await getTopics(page);
  console.log(grabbedTopics);

  await runDownloadLoop(
    page,
    subjectNumber,
    lessonNumber,
    grabbedTopics.length
  );

  // await clickTopic(page, 1);
  // await clickSlidesMenu(page);
  // await downloadSlides(page);
  // await clickMyCourses(page);
  // await clickSubject(page, subjectNumber);
  // await clickLesson(page, lessonNumber);

  // await browser.close();
}

mainScrape();

////////////////////////////////////////////////////
//////////// FUNCTION DEFINITIONS //////////////////
////////////////////////////////////////////////////

const loginPESU = async function (page, email, password) {
  // function: login and wait for idle
  // scope for optimaization high
  await page.goto("https://www.pesuacademy.com/Academy", {
    waitUntil: "networkidle0",
  });

  await page.type("#j_scriptusername", email);
  await page.type(
    "body > div.login-body > div:nth-child(1) > div > div.login-form > form > fieldset > div:nth-child(3) > input",
    password
  );

  await page.click(
    "body > div.login-body > div:nth-child(1) > div > div.login-form > form > fieldset > div:nth-child(4)"
  );
  await page.waitForNavigation({ waitUntil: "networkidle0" });
};

const clickMyCourses = async function (page) {
  // click "My Courses"
  await page.waitForSelector("#menuTab_653 > a > span.menu-name");
  await page.$eval("#menuTab_653 > a > span.menu-name", (elem) => elem.click());
};

const getSubjects = async function (page) {
  // Get All Subjects
  await page.waitForSelector(".table");
  return await page.evaluate(() => {
    const mainSubjects = document.querySelectorAll(".table tbody tr");
    let subjects = [];
    mainSubjects.forEach((sub) => subjects.push(sub.innerText));
    return subjects;
  });
};

const clickSubject = async function (page, subjectNumber) {
  // click ith subject
  await page.waitForSelector(
    "#getStudentSubjectsBasedOnSemesters > div > div > table > tbody > tr > td"
  );
  await page.$eval(
    `#getStudentSubjectsBasedOnSemesters > div > div > table > tbody > tr:nth-child(${subjectNumber}) > td`,
    (elem) => elem.click()
  );
};

const clickLesson = async function (page, lessonNumber) {
  // get previous topics (before lesson change)
  await page.waitForSelector("#CourseContentId .table tbody tr");
  const prevTopics = await page.evaluate(() => {
    const topics = document.querySelectorAll(
      "#CourseContentId .table tbody tr"
    );
    let subTopics = [];
    topics.forEach((title) => subTopics.push(title.innerText.split("\t")[0]));
    return subTopics;
  });

  // click ith lesson
  await page.waitForSelector(
    ".course-info-content .tab-content #courseUnits #courselistunit li:nth-of-type(5) a"
  );
  await page.$eval(
    `.course-info-content .tab-content #courseUnits #courselistunit li:nth-of-type(${lessonNumber}) a`,
    (elem) => elem.click()
  );

  // check if topics have changed compared to previous ones
  await page.waitForFunction(
    (prevTopic1) => {
      if (
        prevTopic1 !=
        document
          .querySelector("#CourseContentId .table tbody tr")
          .innerText.split("\t")[0]
      )
        return true;
      return false;
    },
    {},
    prevTopics[0]
  );
};

const getTopics = async function (page) {
  // get all topics
  await page.waitForSelector("#CourseContentId .table tbody tr");
  return await page.evaluate(() => {
    const topics = document.querySelectorAll(
      "#CourseContentId .table tbody tr"
    );
    let subTopics = [];
    topics.forEach((title) => subTopics.push(title.innerText.split("\t")[0]));
    return subTopics;
  });
};

const clickTopic = async function (page, topicNumber) {
  // click ith topic
  await page.waitForSelector(
    `#CourseContentId table tbody tr:nth-of-type(${topicNumber})`
  );
  await page.$eval(
    `#CourseContentId table tbody tr:nth-of-type(${topicNumber})`,
    (elem) => elem.click()
  );
};

const clickSlidesMenu = async function (page) {
  // to handle 'AV summary' section sometimes containing a link which gets selected by the selector
  let need;
  await page.waitForSelector("#CourseContent .tab-content");
  need = await page.evaluate(() => {
    if (
      document.querySelector(
        "#CourseContent .tab-content .content-type-area div .col-md-12"
      )
    )
      return 1;
    return 0;
  });

  // click slides
  await page.waitForSelector("#courseMaterialContent > li:nth-child(3) > a");
  await page.$eval("#courseMaterialContent > li:nth-child(3) > a", (elem) =>
    elem.click()
  );

  // check if the selector is selecting a video link, if so, wait until that changes
  if (need)
    await page.waitForFunction(() => {
      if (
        document
          .querySelector(
            "#CourseContent .tab-content .content-type-area div .col-md-12 .link-preview"
          )
          .getAttribute("onclick")
          .includes("vimeo")
      )
        return false;
      return true;
    });
};

const downloadSlides = async function (page) {
  // Download Type: Both
  try {
    await page.waitForSelector(
      ".tab-content > div > div > iframe,.tab-content > div > iframe, .content-type-area .link-preview iframe,#CourseContent .tab-content .content-type-area .link-preview",
      { timeout: 1000 }
    );
  } catch {
    if (
      await page.evaluate(() => {
        if (
          document.querySelector(".tab-content > .tab-pane > h2")?.innerText ==
            "No Slides Content to Display" ||
          document.querySelector(".tab-content > .tab-pane > h2")?.innerText ==
            "No Notes Content to Display"
        )
          return 1;
        else return 0;
      })
    )
      return;
    else {
      await page.evaluate(() => {
        let downloadArr = document.querySelectorAll(
          "#CourseContent .tab-content .content-type-area div"
        );
        // filter duplicate elements belonging to same row
        downloadArr = Array.from(downloadArr).filter((el) =>
          el.querySelector(".col-md-12 , iframe")
        );
        // replaced forEach with function because needed to implement timeOut to fix multiple slides in a page not downloading properly
        let countEle = 0;
        const clickIt = async () => {
          if (countEle >= downloadArr.length) return; // stop
          if (downloadArr[countEle].querySelector("iframe.elem-fullscreen")) {
            const btn = document.createElement("a");
            btn.setAttribute(
              "href",
              downloadArr[countEle].querySelector("iframe.elem-fullscreen").src
            );
            btn.setAttribute("download", "FILE_NAME");
            btn.click();
          } else downloadArr[countEle].querySelector(".link-preview").click();
          countEle++;
          if (countEle >= downloadArr.length) return;
          await setTimeout(clickIt, 1000);
        };
        clickIt();
      });
      return;
    }
  }
  await page.evaluate(() => {
    let downloadArr = document.querySelectorAll(
      "#CourseContent .tab-content .content-type-area div"
    );
    // filter duplicate elements belonging to same row
    downloadArr = Array.from(downloadArr).filter((el) =>
      el.querySelector(".col-md-12 , iframe")
    );
    // replaced forEach with function because needed to implement timeOut to fix multiple slides in a page not downloading properly
    let countEle = 0;
    const clickIt = async () => {
      if (countEle >= downloadArr.length) return; // stop
      if (downloadArr[countEle].querySelector("iframe.elem-fullscreen")) {
        const btn = document.createElement("a");
        btn.setAttribute(
          "href",
          downloadArr[countEle].querySelector("iframe.elem-fullscreen").src
        );
        btn.setAttribute("download", "FILE_NAME");
        btn.click();
      } else downloadArr[countEle].querySelector(".link-preview").click();
      countEle++;
      if (countEle >= downloadArr.length) return;
      await setTimeout(clickIt, 1000);
    };
    clickIt();
  });
};

const runDownloadLoop = async function (
  page,
  subjectNumber,
  lessonNumber,
  numsOfTopics
) {
  for (let l = 1; l <= numsOfTopics; l++) {
    await clickTopic(page, l);
    await clickSlidesMenu(page);
    await downloadSlides(page);
    await clickMyCourses(page);
    await clickSubject(page, subjectNumber);
    await clickLesson(page, lessonNumber);
  }
};

/////////////////////////////////////////////////////
//////////// OLD CODE ///////////////////////////////
/////////////////////////////////////////////////////

// download slide
// type: download
// await page.waitForSelector(".content-type-area .link-preview");
// await page.evaluate(() => {
//   const downloadObj = document.querySelectorAll(
//     ".content-type-area .link-preview"
//   );
//   downloadObj.forEach((el) => {
//     el.click();
//   });
// });

// download slide
//type: slide
// await page.waitForSelector(".tab-content > div > div > iframe");
// await page.evaluate(() => {
//   const pdfObj = document.querySelectorAll(
//     ".tab-content > div > div > iframe"
//   );
//   pdfObj.forEach((el) => {
//     const btn = document.createElement("a");
//     btn.setAttribute("href", el.src);
//     btn.setAttribute("download", "FILE_NAME1");
//     btn.click();
//   });
// });

///////////////////////////
// without download loop
///////////////////////////
// await clickTopic(page, 1);
// await clickSlidesMenu(page);
// await downloadSlides(page);
// await clickMyCourses(page);
// await clickSubject(page, subjectNumber);
// await clickLesson(page, lessonNumber);

///////////////////////////////////////
///////// Old Downloader //////////////
///////////////////////////////////////
// const downloadSlides = async function (page) {
//   // Download Type: Both
//   try {
//     await page.waitForSelector(
//       ".tab-content > div > div > iframe, .content-type-area .link-preview",
//       { timeout: 1000 }
//     );
//   } catch {
//     if (
//       await page.evaluate(() => {
//         if (
//           document.querySelector(".tab-content > .tab-pane > h2")?.innerText ==
//           "No Slides Content to Display"
//         )
//           return 1;
//         else return 0;
//       })
//     )
//       return;
//     else {
//       await page.evaluate(() => {
//         const downloadObj = document.querySelectorAll(
//           ".content-type-area .link-preview"
//         );
//         downloadObj.forEach((el) => {
//           el.click();
//         });
//       });
//       await page.evaluate(() => {
//         const pdfObj = document.querySelectorAll(
//           ".tab-content > div > div > iframe"
//         );
//         pdfObj.forEach((el) => {
//           const btn = document.createElement("a");
//           btn.setAttribute("href", el.src);
//           btn.setAttribute("download", "FILE_NAME1");
//           btn.click();
//         });
//       });
//       return;
//     }
//   }
//   await page.evaluate(() => {
//     const downloadObj = document.querySelectorAll(
//       ".content-type-area .link-preview"
//     );
//     downloadObj.forEach((el) => {
//       el.click();
//     });
//   });
//   await page.evaluate(() => {
//     const pdfObj = document.querySelectorAll(
//       ".tab-content > div > div > iframe"
//     );
//     pdfObj.forEach((el) => {
//       const btn = document.createElement("a");
//       btn.setAttribute("href", el.src);
//       btn.setAttribute("download", "FILE_NAME1");
//       btn.click();
//     });
//   });
// };
