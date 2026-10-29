import "./style.css";
import { Greeter, namesOnlyStyle } from "@example/greeter";

/** Heading displaying the current greeting. */
const el = window.document.createElement("h1");
window.document.body.appendChild(el);
el.id = "title";
el.innerText = new Greeter().greet();

/** Metadata listing the recipients addressed by the heading. */
const htmlAttributes = { "data-recipients": new Greeter(namesOnlyStyle).greet() };
Object.entries(htmlAttributes).forEach(([name, value]) => el.setAttribute(name, value));
