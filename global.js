// Step 1: Helper function
export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 3.1: Define your pages
// Note: Use '' for the root and 'folder/' for others
let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/Xcysteven', title: 'GitHub' },
];

// Step 3.1: Handle GitHub Pages subdirectory
const BASE_PATH = location.hostname === 'localhost' ? '/' : '/personal_website/';

// Create and add the nav
let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
    let url = p.url;
    let title = p.title;

    // Adjust URLs for the base path
    url = !url.startsWith('http') ? BASE_PATH + url : url;

    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;

    // Step 3.2: Highlight current page and handle external links
    a.classList.toggle('current', a.host === location.host && a.pathname === location.pathname);
    
    if (a.host !== location.host) {
        a.target = '_blank';
    }

    nav.append(a);
}

// Step 4.2: Add Dark Mode Switcher
document.body.insertAdjacentHTML(
  'afterbegin',
  `
	<label class="color-scheme">
		Theme:
		<select id="theme-switcher">
			<option value="light dark">Automatic</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</label>`
);

const select = document.querySelector('#theme-switcher');

// Step 4.4 & 4.5: Logic for changing and saving the theme
function setColorScheme(colorScheme) {
    document.documentElement.style.setProperty('color-scheme', colorScheme);
    select.value = colorScheme;
    localStorage.colorScheme = colorScheme;
}

select.addEventListener('input', (event) => setColorScheme(event.target.value));

if ('colorScheme' in localStorage) {
    setColorScheme(localStorage.colorScheme);
}