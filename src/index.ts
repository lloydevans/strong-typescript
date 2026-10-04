import "./style.css";
import { Greeter } from "./greeting";

/** Heading displaying the current greeting. */
const el = window.document.createElement("h1");
window.document.body.appendChild(el);
el.id = "title";
el.innerText = new Greeter().greet();
