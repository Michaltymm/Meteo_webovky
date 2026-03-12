(function () {
    var track = document.querySelector('.carousel-track');
    var imgs = document.querySelectorAll('.carousel-img');
    var dots = document.querySelectorAll('.dot');
    var current = 0;
    function goTo(i) {
        current = (i + imgs.length) % imgs.length;
        track.style.transform = 'translateX(-' + (current * 100) + '%)';
        dots.forEach(function (d, idx) { d.classList.toggle('active', idx === current); });
    }
    document.querySelector('.carousel-btn.prev').addEventListener('click', function () { goTo(current - 1); });
    document.querySelector('.carousel-btn.next').addEventListener('click', function () { goTo(current + 1); });
    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { goTo(i); }); });
})();
