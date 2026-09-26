const API_BASE="https://ai-saas-cover-letter-generator-1.onrender.com";


const formData={
    name:"",
    role:"",
    company:"",
    skills:"",
};
 
let mode="template";
const fields=document.querySelectorAll("[data-key]");
fields.forEach((field)=>{
    field.addEventListener("input",(e)=>{
        formData[e.target.dataset.key]=e.target.value;
    });
});
document.querySelectorAll('input[name="mode"]').forEach((radio)=>{
    radio.addEventListener("change",(e)=>
    {
        mode=e.target.value;
    });
});

function buildLetter(data){
  const name=data.name||"Sakshi Kumari";
  const role=data.role||"Full Stack Developer";
  const company=data.company||"Prodesk IT";
  const skills=data.skills||"MERN,DSA";
  return `Dear Hiring Manager at ${company},
  I am ${name}, and I am writing to express my interest in the ${role} position at ${company},with hands-on experience in ${skills},I am confident that I can contribute meaningfully to your team.
  Thank you for considering my application.
  Sincerely,
  ${name} `;
}
const resumeInput=document.getElementById("resume");
const resumeStatus=document.getElementById("resume-status");
resumeInput.addEventListener("change",async()=>{
    const file=resumeInput.files[0];
    if(!file) return;
    resumeStatus.textContent="Parsing resume...";
    const body=new FormData();
    body.append("resume",file);
    try{
        const res=await fetch(`${API_BASE}/api/parse-resume`,{
            method:"POST",
            body,
        });
        if(!res.ok) throw new Error("Server rejected the file");
        const data=await res.json();
        formData.resumeText=data.text;
        resumeStatus.textContent=`Resume loaded(${data.text.length} characters extracted)`;
    }
    catch(err){
        formData.resumeText="";
        resumeStatus.textContent="Could not parse that PDF-try another file,";
    }
});
async function generateWithAI(data){
    const res=await fetch(`${API_BASE}/api/generate-letter`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data),
    });
    if(!res.ok){
        const errBody=await res.json().catch(()=>({}));
        throw new Error(errBody.error||`Request failed(${res.status})`);

    }
    const { letter }=await res.json();
    return letter;
}
const form=document.getElementById("cover-letter-form");
const generateBtn=document.getElementById("generate-btn");
const statusLine=document.getElementById("status-line");
const output=document.getElementById("output");
form.addEventListener("submit",async(e)=>{
    e.preventDefault();
    generateBtn.disabled=true;
    statusLine.classList.remove("error");
    output.textContent="";

    if(mode=="template"){
        statusLine.textContent="Assembling template...";
        output.textContent=buildLetter(formData);
        statusLine.textContent="";
        generateBtn.disabled=false;
        return;
    }
    statusLine.innerText="Generating...this can take a few seconds";
    try{
        const letter=await generateWithAI(formData);
        output.textContent=letter;
        statusLine.textContent="";
    }
    catch(err){
        statusLine.textContent=err.message;
        statusLine.classList.add("error");

    }
    finally{
        generateBtn.disabled=false;
    }
});
const copyBtn=document.getElementById("copy-btn");
copyBtn.addEventListener("click",()=>{
    const text=output.textContent;
    if(!text){
        copyBtn.textContent="Nothing to copy yet";
        setTimeout(()=>(copyBtn.textContent="Copy to clipboard"),1500);
        return;
    }
    navigator.clipboard.writeText(text).then(()=>{
        copyBtn.textContent="Copied";
        setTimeout(() => (copyBtn.textContent="Copy to clipboard"),1500);
            
        });
    });