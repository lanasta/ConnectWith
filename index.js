const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');
const app = express();
let searchResults = {};

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
    const wsChromeEndpointurl = 'ws://127.0.0.1:9222/devtools/browser/a36e5926-0f4b-4662-ac0d-b9dc42e9dc35';
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

async function buildObjectFromElements(page, callback) {
    let userSearchResults = {};
    let counter = 0;
    let elements = await page.$$('.search-result__info');
    console.log('len', elements.length);
    await elements.map(async (element) => {
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
        userSearchResults[keyName] = properties;
        searchResults["searchResults"] = userSearchResults;
        console.log(searchResults);
        counter += 1;
        if (counter == elements.length) {
            callback(searchResults);
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



