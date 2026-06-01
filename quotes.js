export function getQuoteForState(netBalance, income, outcome) {
    if (netBalance < 0) {
        return "Imagine this kind of life you have right now continue, what would you have left in your older years later?";
    }
    
    if (outcome > income * 0.8) {
        return "You're spending close to what you earn. Remember the 50/30/20 rule: needs, wants, and savings.";
    }

    if (netBalance > 10000000) {
        return "Great job keeping a healthy balance! Your future self will thank you for the discipline.";
    }

    if (income === 0 && outcome === 0) {
        return "A journey of a thousand miles begins with a single step. Start tracking your finances today.";
    }

    const generalQuotes = [
        "Do not save what is left after spending, but spend what is left after saving. – Warren Buffett",
        "Wealth consists not in having great possessions, but in having few wants. – Epictetus",
        "Money is a terrible master but an excellent servant. – P.T. Barnum",
        "A budget is telling your money where to go instead of wondering where it went. – Dave Ramsey"
    ];

    // Pick a random general quote based on the current day
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    return generalQuotes[dayOfYear % generalQuotes.length];
}

export function updateQuoteUI(netBalance, income, outcome) {
    const quoteElement = document.getElementById('daily-quote');
    if (quoteElement) {
        quoteElement.innerText = getQuoteForState(netBalance, income, outcome);
    }
}
