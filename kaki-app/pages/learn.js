import styles from '../styles/Learn.module.css'
import Pitch from "../components/pitch";

import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { useSession } from "next-auth/react";

// States: List of words (database query), answer the user has chosen (user input)

// Steps
// Is a user logged in? -> check session.user
// Does the user have study items in category? query studyItemsByUserCat(user, category)
   // If no study items, initialize the list: 
        // query wordsByCategory(category)
        // mutate createStudyItem for each word
        // for each twenty words, increment due-date by 24h
// If yes, do any study items have sheduled date <= now?
    // If yes, add to quiz list
// Quiz and update: mutate each studyitem after answer

const CREATE_STUDY_ITEM = gql`
mutation CreateStudyItem($username: String!, $tangoId: Int!, $due: Date!) {
    createStudyItem(username: $username, tangoId: $tangoId, due: $due) {
        ok
        studyItem {
            item {
                tango
                yomi
                pitch
                definition
                pos
            }
            priority
        }
    }
}`

const QUERY_STUDY_ITEMS = gql`
query studyItemsAndWords($username: String, $category: String) {
    studyItems(username: $username, category: $category) {
        item {
            tango
            yomi
            pitch
            definition
            pos
        }
        priority
    }
    words(category: $category) {
        id
        tango
        yomi
        pitch
        definition
        pos
    }
}`

/* Things to look into: Children, context, redux? */

const ChooseCategory = ( { lang, setCategory, displayStyle } ) => {
    const categories = ["N5", "N4", "N3", "N2", "N1"];
    
    if(displayStyle == "menu") {
        return (
        <div className="">
            <div className="categoryGrid sm:text-lg md:text-xl lg:text-2xl">
        {
            categories.map((category, i) => {
            function handleClick(e) {
                e.preventDefault();
                setCategory(category);
            }
            return <button key={"cat-button-" + i} tag={"cat-button-" + i} className="text-sm p-1 mr-4" style={{'background-color': 'rgb(' + (0 + 60 * i) + ', ' + (160 - 20 * i) + ', ' + (180 - 40 * i) + ')'}} onClick={handleClick}>{category}</button>
            })
        }
        </div>
        </div>
        );
    }
    
    return (
        <main className={styles.content}>
            <section className={styles.studyCard}>
                <div className={styles.studyItem}>
                <p className="mb-8">{lang === "EN" ? "Choose a level:" : "挑戦するレベルを選択してください。"}</p>
                <div className={styles.categoryGrid}>
                {
                    categories.map((category, i) => {
                    function handleClick(e) {
                        e.preventDefault();
                        setCategory(category);
                    }
                    return <button className="py-8 rounded-md text-white" key={"cat-button-" + i} tag={"cat-button-" + i} style={{'backgroundColor': 'rgb(' + (0 + 60 * i) + ', ' + (160 - 20 * i) + ', ' + (180 - 40 * i) + ')'}} onClick={handleClick}>{category}</button>
                    })
                }
                </div>
                </div>
            </section>
        </main>
    );
}

function Learn( {lang} ) {

    const [category, setCategory] = useState('');
    const { data: session, status } = useSession();

    if(status === "loading") {
        <section className={styles.studyCard}>
        <div className="text-2xl">
            <h2 className={styles.tango}>{lang === "EN" ? "Loading study session..." : "読み込み中..."}</h2>
        </div>
        </section>
    }

    if (category == '') {
        return <ChooseCategory lang={lang} setCategory={setCategory}/>
    }
    else {
        return <StudyPage lang={lang} session={session} category={category} setCategory={setCategory}/>
    }
}

function StudyPage( { lang, session, category, setCategory } ) {

    const username = session?.user.username;

    const { data, loading, error } = useQuery(QUERY_STUDY_ITEMS, {
        variables: { username, category }
    });

    if (loading) return(
        <section className={styles.studyCard}>
        <div className="text-2xl">
            <h2 className={styles.tango}>{lang === "EN" ? "Loading study session..." : "読み込み中..."}</h2>
        </div>
        </section>);
        
    if (error)   return <pre>{error.message}</pre>;
    
    // Shuffle currently-due words. TODO: Will need to shuffle according to time due?
    let wordList = fisherYates(data.words);
    let initialState = getNextWord(wordList);

    return(
        <main className={styles.content}>
            <StudyCard lang={lang} chooseCategory={setCategory} currentWord={initialState.word} wordList={initialState.words}/>
        </main>
    );
}

const StudyCard = ( { lang, currentWord, setCategory, wordList }) => {

    const [studyState, setStudyState] = useState({word: currentWord, words: wordList});;
    const [visible, setVisible] = useState(false);

    if(wordList != studyState.words) {
        setStudyState( {word: currentWord, words: wordList});
    }

    if(studyState.word == null && studyState.words.length == 0) {
        return(
            <section className={styles.studyCard}>
                <div className="text-2xl">
                    <h2 className={styles.tango}>{lang === "EN" ? "Congrats! You finished studying for today!" : "おめでとうございます！今日の学習が終わりました。"}</h2>
                </div>
            </section>
        );
    }

    let answerList = [];
    if (studyState.word != null) {
        answerList = generateAnswers(studyState.word);
    }

    return(
        <section className="grid grid-cols-1 w-full h-full text-lg md:text-xl lg:text-2xl">
            <section className="relative shadow-md grid grid-cols-1 w-full place-items-center justify-center">
                <div className="grid grid-cols-1 w-1/2 mt-4 mb-6">
                    <div class="flex justify-center my-4">
                        <h2 className={styles.tango + " text-7xl md:text-8xl lg:text-9xl mb-5"}>{studyState.word?.tango}</h2>
                    </div>
                    <div class="mb-6">
                        <ButtonGrid currentWord={studyState.word} wordList={wordList} answerList={answerList} setCurrentWord={setStudyState} setVisible={setVisible} />
                    </div>
                </div>
                <div className="flex w-full justify-end pb-2">
                    <ChooseCategory setCategory={setCategory} displayStyle={"menu"}/>
                </div>
            </section>
            <div className="bg-gray-200 w-full border-t-4 border-gray-200 w-full">
                    <Definition word={studyState.word} lang={lang} visible={visible} setVisible={setVisible}/>
            </div>
        </section>
    );
}

const Definition = ( { word, lang, visible, setVisible } ) => {
    
    function handleClick(e) {
        e.preventDefault();
        setVisible(!visible);
    }

    let text = "";
    if(!visible) {
        text = lang === 'EN' ? "Show word details" : "詳細を表示する";
    }
 
    return(
        <div className="overflow-scroll h-full">
            {! visible && (<div onClick={handleClick} className="hover:cursor-pointer flex w-full h-full items-center justify-center">
                <button onClick={handleClick}>{text}</button>
                </div>)}
            {visible && (
            <div style={{visibility: (visible ? "visible" : "hidden")}} className="flex flex-row h-full">
                <div className="flex border-r-2 border-gray-400 w-1/4 justify-center items-center text-center px-1 my-4">
                    <div className="h-1/2">
                        <p className="text-orange-700 text-2xl mb-3">{word.tango}</p>
                        <p className="text-lg font-normal text-black"><Pitch word={word}/></p>
                    </div>
                </div>
                <div className="text-lg font-normal text-black w-3/4 p-4">
                    <p>{word.pos}</p>
                    <p>{word.definition}</p>
                </div>
            </div>)}
        </div>
    );
}

const ButtonGrid = ( { wordList, answerList, setCurrentWord, setVisible } ) => {

    const [answerState, setAnswerState] = useState({ clicked: -1, result: ''});

    const toNextWord = ( result, i ) => {
        setAnswerState({ clicked: i, result: result });
        setTimeout(() => {
            setCurrentWord(getNextWord(wordList));
            setAnswerState({ clicked: -1, result: ''});
            setVisible(false);
        }, 1500);
    }

    let feedback = (answerState.result == "correct" ? "正解！" : "次は頑張ってね！");
    return(
        <div className={styles.response}>
            <div className={styles.buttonGrid}>
                {answerList.map((option, i) =>             
                <AnswerButton key={"button" + i} i={i} answerState={answerState} option={option} toNextWord={toNextWord}/>)}
            </div>
            <div className={styles.feedback} style={{"visibility": (answerState.clicked == -1 ? "hidden" : "visible")} }>
                <p>{feedback}</p>
            </div>
        </div>
    );

}

const AnswerButton = ( { i, option, answerState, toNextWord } ) => {
    
    let feedback = '';
    console.log(answerState.clicked);

    if(answerState.clicked >= 0) {
        if (option.correct) {
            feedback = "correct";
        }
        else if (i == answerState.clicked && !option.correct) {
            feedback = "incorrect";
        }
    } 

    const handleClick = (e) => {
        e.preventDefault;
        let result = "correct";
        if(!option.correct) {
            result = "incorrect"
        }
        toNextWord(result, i);
    }

    return (
        <button disabled={ (feedback != '' ? true : false) } className={styles[feedback]} onClick={handleClick}>
            <Pitch word={option} />
        </button>
    );
}

function getNextWord(words) {
    let word = words.pop();
    console.log("Got word " + word);
    return { word: word, words: words};
}

function getRandomWord(words) {
    return words.pop();
}

function generateAnswers(word) {
   
    let morae = getMorae(word.yomi);
    let answers = [];
    let correctAnswer = {};

    for(let i=0; i < morae.length+1; i++) {
        let answer = { 
            yomi: word.yomi,
            pitch: i,
            correct: (i == word.pitch ? true : false)
        };
        if( i != word.pitch) {
            answers.push(answer);
        } else {
            correctAnswer = answer;
        }
    }

    answers = fisherYates(answers).filter((word) => {
        let pitchedMora = word.yomi[word.pitch-1];
        let invalidMorae = ["っ", "ー"];
        return (word.pitch == 0 || !invalidMorae.includes(pitchedMora));
    });

    answers = answers.length > 3 ? answers.slice(0, 3) : answers;
    
    let randIdx = Math.floor(Math.random() * answers.length);
    answers.splice(randIdx, 0, correctAnswer);
    
    return answers;
}

function fisherYates(arr) {
    var shuffled = arr.slice(0), i = arr.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    return shuffled;
}

// TODO: Currently duplicated in pitch.js
const getMorae = (word) => {
    
    let chars = word.split('');
    let morae = [];
    let currentMora = chars.shift();
  
    for(let i in chars) {
        if(['ゃ','ゅ','ょ'].includes(chars[i])) {
            currentMora += chars[i];
        } else {
            morae.push(currentMora);
            currentMora = chars[i];
        }
    }
    morae.push(currentMora);
    return morae;
}

export default Learn;