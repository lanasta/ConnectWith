const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const app = express();
let searchResults = {};

app.get('/logo.png', function(req, res) {
    res.sendFile(__dirname + "/logo.png");
});

app.get('/favicon.ico', function(req, res) {
    res.sendFile(__dirname + "/favicon.ico");
});

app.get('/bg.jpg', function(req, res) {
    res.sendFile(__dirname + "/bg.jpg");
});

app.get('/master.css', function(req, res) {
    res.sendFile(__dirname + "/master.css");
  });

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/api/searchConnections/:skill', async (req, res) => {
    var skill = req.params.skill;
    getLinkedInConnections(skill, (result) => {
        console.log(result); // "Some User token"
        res.json(result);
    });
})

app.listen(3000, console.log('Listening on port 3000...'));

async function getLinkedInConnections(keyword, callback) {
    const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/29f61f48-65dc-4480-8882-4f32cafc4258';
    const browser = await puppeteer.connect({
        browserWSEndpoint: wsChromeEndpointurl,
        headless: true
    });

    const page = await browser.newPage();
    const url = 'https://www.linkedin.com/search/results/people/?facetNetwork=%5B%22F%22%5D&keywords=' + keyword + '&origin=FACETED_SEARCH';
    await page.goto(url, {
    });

    await page.setViewport({
        width: 1200,
        height: 800
    });
    await autoScroll(page);
    await page.waitForFunction(
        'document.querySelector("body").innerText.includes("Try searching for")'
      );
    await buildObjectFromElements(page, callback);
}

async function sendMessage(page, name, confirm, callback) {
    let elements = await page.$$('.message-anywhere-button');
    await elements.map(async (element) => {
        const outerHtml = await page.evaluate(element => element.outerHTML, element);
        if (outerHtml.indexOf(name) > -1){
            await element.click();
            await page.type('.msg-form__contenteditable', 'test comment whats good', {delay: 20})
            if (confirm) {
                await page.keyboard.press('Enter');        
            }
        }
    });    
}

async function buildObjectFromElements(page, callback) {
    let userSearchResults = [];
    let counter = 0;
    let elements = await page.$$('.search-result__info');
    console.log(elements);
    await elements.map(async (element) => {
        console.log(element);
        let properties = {};
        let names = await element.$$(".actor-name");
        properties.name = await parseTextElement(page, names);
        let curTitles = await element.$$('.subline-level-1');
        properties.curTitle = await parseTextElement(page, curTitles);
        let locations = await element.$$('.subline-level-2');
        properties.location = await parseTextElement(page, locations);
        let profileSnippets = await element.$$('.search-result__snippets');
        properties.profileSnippet = await parseTextElement(page, profileSnippets);
        let keyName = await transformToKey(properties.name);  
        let userObj = {};
        userObj[keyName] = properties;
        userSearchResults.push(userObj);
        counter += 1;
        if (counter == elements.length) {
            callback({"searchResults" : userSearchResults});
        }
    });
}

async function autoScroll(page){
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function transformToKey(text) {
    return (text.replace(/\s/g, '')).toLowerCase();
}

async function parseTextElement(page, elements) {
    if (page && elements.length > 0) {
        let element = elements[0];
        const text = await page.evaluate(element => element.textContent, element);
        return text ? sanitizeText(text) : "";
    }
    return "";
}

async function sanitizeText(text) {
    return (text.replace(/(\r\n|\n|\r)/gm,"")).trim();
}
