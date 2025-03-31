import { EVENT_QUEUE } from '../../scripts/target.js';

export default function decorate(block) {
    // block.dataset.targetId = "target-html-block-1";
    window.addEventListener('target-response', async () => {
        EVENT_QUEUE.forEach(function (response) {
            if (response.key === block.dataset.decisionScope) {
                block.innerHTML = response.data[0]?.data.content;
            }
        })
        console.log("target-block", block);
      }, { once: true });
}
console.log(EVENT_QUEUE);